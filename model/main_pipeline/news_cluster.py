import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict
import warnings
import logging

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, adjusted_rand_score
import hdbscan
import matplotlib.pyplot as plt
from collections import Counter

warnings.filterwarnings('ignore')
logging.getLogger('sentence_transformers').setLevel(logging.ERROR)
plt.rcParams['font.family'] = ['AppleGothic', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

def convert_numpy_types(obj):
    """numpy int, float 타입을 python 기본 타입으로 변환 재귀함수"""
    if isinstance(obj, dict):
        return {convert_numpy_types(k): convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(x) for x in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    else:
        return obj

class KoSimCSENewsPipeline:
    def __init__(self, config: Dict = None):
        self.config = {
            'model_name': 'BM-K/KoSimCSE-roberta-multitask',
            'batch_size': 16,
            'min_text_length': 50,
            'min_title_length': 10,
            'max_text_length': 1000,
            'clustering_methods': ['HDBSCAN', 'K-Means', 'DBSCAN'],
            'hdbscan_params': {
                'min_cluster_size': 12,
                'min_samples': 8,
                'metric': 'euclidean',
                'cluster_selection_epsilon': 0.0
            },
            'kmeans_params': {
                'n_init': 20,
                'max_iter': 500,
                'random_state': 42
            },
            'dbscan_params': {
                'eps': 0.3,
                'min_samples': 10,
                'metric': 'cosine'
            },
            'output_dir': str(Path(__file__).resolve().parents[2] / "results" / "cluster_results"),
            'save_visualizations': True
        }
        if config:
            self.config.update(config)

        self.model = None
        self.articles_df = None
        self.embeddings = None
        self.cluster_labels = None
        self.best_method = None
        self.cluster_analysis = None

        base_dir = Path(__file__).resolve().parents[2]
        self.output_dir = (base_dir / "model" / "results" / "cluster_results").resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)

        print(f"🚀 KoSimCSE 뉴스 클러스터링 파이프라인 초기화")
        print(f"   출력 디렉토리: {self.output_dir}")

    def load_model(self) -> bool:
        print(f"\n🤖 모델 로딩: {self.config['model_name']}")
        try:
            self.model = SentenceTransformer(self.config['model_name'])
            print(f"✅ 모델 로드 성공!   차원: {self.model.get_sentence_embedding_dimension()}")
            return True
        except Exception as e:
            print(f"❌ 모델 로딩 실패: {e}")
            return False

    def load_news_data(self, file_path: str) -> bool:
        print(f"\n📊 뉴스 데이터 로딩...")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                news_data = json.load(f)
            print(f"✅ 파일 로드 성공: {file_path}")

            if 'news' not in news_data or not isinstance(news_data['news'], dict):
                print("❌ JSON 구조에 문제가 있습니다. 'news' 키와 딕셔너리 타입을 확인하세요.")
                return False

            articles = []
            category_stats = {}

            for category, article_list in news_data['news'].items():
                if not isinstance(article_list, list):
                    continue
                for article in article_list:
                    title = article.get('title', '').strip()
                    content = article.get('content', '').strip()
                    full_text = f"{title}. {content}".strip()
                    if (len(full_text) >= self.config['min_text_length'] and
                        len(title) >= self.config['min_title_length'] and
                        len(full_text) <= self.config['max_text_length']):
                        articles.append({
                            **article,
                            'title': title,
                            'content': content,
                            'fullText': full_text,
                            'textLength': len(full_text),
                            'category': category,
                            'index': len(articles)
                        })
                        category_stats[category] = category_stats.get(category, 0) + 1

            self.articles_df = pd.DataFrame(articles)
            print(f"✅ 전처리 완료: {len(articles)}개 기사")
            print("카테고리별 분포:")
            for cat, count in category_stats.items():
                print(f"  {cat}: {count}개")
            return True
        except Exception as e:
            print(f"❌ 데이터 로딩 실패: {e}")
            return False

    def generate_embeddings(self) -> bool:
        print(f"\n⚡ KoSimCSE 임베딩 생성 중...")
        if self.model is None or self.articles_df is None:
            print("❌ 모델 또는 뉴스 데이터가 준비되지 않았습니다.")
            return False
        try:
            TITLE_WEIGHT = 2.5

            titles = self.articles_df['title'].fillna('').tolist()
            bodies = self.articles_df['content'].fillna('').map(lambda s: s[:600]).tolist()

            E_t = self.model.encode(
                titles,
                batch_size=self.config['batch_size'],
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            E_b = self.model.encode(
                bodies,
                batch_size=self.config['batch_size'],
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True
            )

            emb = (TITLE_WEIGHT * E_t + E_b) / (TITLE_WEIGHT + 1.0)
            # L2 재정규화
            emb = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-12)

            self.embeddings = emb
            print(f"✅ 임베딩 생성 완료! 형태: {self.embeddings.shape}")
            return True
        except Exception as e:
            print(f"❌ 임베딩 생성 실패: {e}")
            return False

    def run_clustering(self) -> Dict:
        print(f"\n🔍 클러스터링 알고리즘 실행 중...")
        if self.embeddings is None:
            print("❌ 임베딩이 생성되지 않았습니다.")
            return {}

        results = {}
        scores = {}

        if 'HDBSCAN' in self.config['clustering_methods']:
            print("1. HDBSCAN 클러스터링...")
            try:
                clusterer = hdbscan.HDBSCAN(**self.config['hdbscan_params'])
                labels = clusterer.fit_predict(self.embeddings)
                results['HDBSCAN'] = labels
                valid_mask = labels != -1
                if valid_mask.sum() > 1 and len(set(labels[valid_mask])) > 1:
                    score = silhouette_score(self.embeddings[valid_mask], labels[valid_mask])
                    scores['HDBSCAN'] = score
                n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                n_noise = np.sum(labels == -1)
                print(f"   ✅ 완료: {n_clusters}개 클러스터, 노이즈 {n_noise}개")
            except Exception as e:
                print(f"   ❌ HDBSCAN 실패: {e}")

        if 'K-Means' in self.config['clustering_methods']:
            print("2. K-Means 클러스터링...")
            try:
                n = len(self.embeddings)
                k_min = max(4, int(np.sqrt(n)))           # 데이터 크기 기반 하한
                k_max = min(24, max(6, int(np.sqrt(n)*2)))# 상한
                best_k, best_score, best_labels = None, -1, None

                for k in range(k_min, k_max + 1):
                    if k >= n:
                        break
                    km = KMeans(n_clusters=k, **self.config['kmeans_params'])
                    lbl = km.fit_predict(self.embeddings)
                    # 실루엣은 군집 2개 이상일 때만 유효
                    if len(set(lbl)) < 2:
                        continue
                    sc = silhouette_score(self.embeddings, lbl)
                    if sc > best_score:
                        best_k, best_score, best_labels = k, sc, lbl

                if best_labels is None:
                    # 안전망: 기존 방식으로라도 한 번 계산
                    fallback_k = min(15, max(2, k_min))
                    km = KMeans(n_clusters=fallback_k, **self.config['kmeans_params'])
                    best_labels = km.fit_predict(self.embeddings)
                    best_k, best_score = fallback_k, silhouette_score(self.embeddings, best_labels) if len(set(best_labels))>1 else -1

                results['K-Means'] = best_labels
                scores['K-Means'] = best_score
                print(f"   ✅ 완료: {best_k}개 클러스터, 실루엣 {best_score:.3f}")

            except Exception as e:
                print(f"   ❌ K-Means 실패: {e}")

        if 'DBSCAN' in self.config['clustering_methods']:
            print("3. DBSCAN 클러스터링...")
            try:
                dbscan = DBSCAN(**self.config['dbscan_params'])
                labels = dbscan.fit_predict(self.embeddings)
                results['DBSCAN'] = labels
                valid_mask = labels != -1
                if valid_mask.sum() > 1 and len(set(labels[valid_mask])) > 1:
                    score = silhouette_score(self.embeddings[valid_mask], labels[valid_mask])
                    scores['DBSCAN'] = score
                n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                n_noise = np.sum(labels == -1)
                print(f"   ✅ 완료: {n_clusters}개 클러스터, 노이즈 {n_noise}개")
            except Exception as e:
                print(f"   ❌ DBSCAN 실패: {e}")

        if scores:
            self.best_method = max(scores, key=scores.get)
            self.cluster_labels = results[self.best_method]
            self.cluster_labels = self._postprocess_labels(self.cluster_labels, split_threshold=0.38, min_size=8)
            print(f"\n🎯 최적 방법: {self.best_method} (실루엣 계수: {scores[self.best_method]:.3f})")
        elif results:
            if 'HDBSCAN' in results:
                self.best_method = 'HDBSCAN'
                self.cluster_labels = results['HDBSCAN']
            else:
                self.best_method = list(results.keys())[0]
                self.cluster_labels = results[self.best_method]
            self.cluster_labels = self._postprocess_labels(self.cluster_labels, split_threshold=0.38, min_size=8)
            print(f"\n🎯 선택된 방법: {self.best_method}")

        return results
    
    def analyze_clusters(self) -> Dict:
        print(f"\n📊 클러스터 분석 중...")
        if self.cluster_labels is None:
            print("❌ 클러스터링이 실행되지 않았습니다.")
            return {}

        unique_clusters = sorted(set(self.cluster_labels))
        analysis = {}
        
        for cluster_id in unique_clusters:
            mask = self.cluster_labels == cluster_id
            cluster_articles = self.articles_df[mask]
            
            if cluster_id == -1:  # 노이즈
                analysis[cluster_id] = {
                    'size': len(cluster_articles),
                    'type': '노이즈',
                    'sample_titles': cluster_articles['title'].head(3).tolist()
                }
            else:
                cat_dist = cluster_articles['category'].value_counts()
                dominant_cat = cat_dist.index[0] if len(cat_dist) > 0 else 'Unknown'
                purity = (cat_dist.iloc[0] / len(cluster_articles)) if len(cat_dist) > 0 else 0
                top_articles = cluster_articles.nlargest(3, 'textLength')
                analysis[cluster_id] = {
                    'size': len(cluster_articles),
                    'dominant_category': dominant_cat,
                    'purity': purity,
                    'categories': dict(cat_dist.head(3)),
                    'representative_titles': top_articles['title'].tolist(),
                    'avg_text_length': cluster_articles['textLength'].mean(),
                    'sample_articles': cluster_articles.sample(min(3, len(cluster_articles)))['title'].tolist()
                }
        # numpy 타입을 json 호환 기본 타입으로 변환
        analysis_conv = {str(int(k)): convert_numpy_types(v) for k, v in analysis.items()}
        self.cluster_analysis = analysis_conv
        return analysis_conv
    
    def calculate_metrics(self) -> Dict:
        print(f"\n📏 품질 지표 계산 중...")
        if self.cluster_labels is None:
            return {}

        category_to_id = {cat: i for i, cat in enumerate(self.articles_df['category'].unique())}
        true_labels = np.array([category_to_id[cat] for cat in self.articles_df['category']])
        metrics = {}

        valid_mask = self.cluster_labels != -1
        if valid_mask.sum() > 0:
            valid_pred = self.cluster_labels[valid_mask]
            valid_true = true_labels[valid_mask]
            valid_embeddings = self.embeddings[valid_mask]
            if len(set(valid_pred)) > 1:
                silhouette = silhouette_score(valid_embeddings, valid_pred)
                metrics['silhouette'] = silhouette
                ari = adjusted_rand_score(valid_true, valid_pred)
                metrics['ari'] = ari
                total_purity = 0
                for cluster_id in set(valid_pred):
                    cluster_mask = valid_pred == cluster_id
                    if cluster_mask.sum() > 0:
                        cluster_true = valid_true[cluster_mask]
                        most_common_count = Counter(cluster_true).most_common(1)[0][1]
                        cluster_purity = most_common_count / len(cluster_true)
                        total_purity += cluster_purity * len(cluster_true)
                overall_purity = total_purity / len(valid_pred)
                metrics['purity'] = overall_purity
                metrics['n_clusters'] = len(set(valid_pred))
                metrics['noise_ratio'] = (self.cluster_labels == -1).sum() / len(self.cluster_labels)
                print(f"  실루엣 계수: {silhouette:.3f}")
                print(f"  조정된 랜드 지수: {ari:.3f}")
                print(f"  전체 순도: {overall_purity:.3f}")
                print(f"  클러스터 수: {len(set(valid_pred))}")
                print(f"  노이즈 비율: {metrics['noise_ratio']:.1%}")
        return metrics
    
    def _postprocess_labels(self, labels, split_threshold=0.38, min_size=8):
        labels = labels.copy()
        if len(labels) == 0:
            return labels

        # 군집 내부 중앙 유사도가 낮으면 2-way 분할
        for cid in sorted(set(labels)):
            if cid == -1:
                continue
            idx = np.where(labels == cid)[0]
            if len(idx) < min_size:
                continue
            V = self.embeddings[idx]
            sim = V @ V.T  # 정규화 임베딩 → 코사인 유사도
            tri = sim[np.triu_indices(len(idx), 1)]
            med = float(np.median(tri))
            if med < split_threshold:
                km = KMeans(n_clusters=2, random_state=42, n_init=10).fit(V)
                sub = km.labels_
                # 새 라벨 할당(최댓값 다음부터)
                base = np.max(labels) if np.max(labels) >= 0 else -1
                a_lbl, b_lbl = base + 1, base + 2
                for j, s in enumerate(sub):
                    labels[idx[j]] = a_lbl if s == 0 else b_lbl

        # 각 포인트가 자기 군집 중심과 너무 멀면 노이즈(-1)로 전환
        for i in range(len(labels)):
            if labels[i] == -1:
                continue
            cid = labels[i]
            members = np.where(labels == cid)[0]
            if len(members) < 3:
                continue
            center = self.embeddings[members].mean(axis=0)
            center = center / (np.linalg.norm(center) + 1e-12)
            cos = float(np.dot(self.embeddings[i], center))
            if cos < 0.20:
                labels[i] = -1

        return labels

    
    def save_results(self):
        print(f"\n💾 결과 저장 중...")
        if self.articles_df is None or self.cluster_labels is None:
            print("❌ 저장할 결과가 없습니다.")
            return
        try:
            results_df = self.articles_df.copy()
            results_df['cluster'] = self.cluster_labels
            results_df['method'] = self.best_method

            # 1) 군집별 원 카테고리 다수결 (economy/society/entertainment 중 하나)
            maj_raw = results_df.groupby("cluster")["category"].agg(lambda s: s.value_counts().idxmax())
            results_df = results_df.merge(maj_raw.rename("cluster_majority_raw"),
                                        left_on="cluster", right_index=True, how="left")

            # 2) 한글 4종으로 보조 매핑 (economy는 텍스트로 국내/해외 분기)
            GLOBAL_HINTS = ["미국","중국","일본","유럽","EU","글로벌","세계","월가","연준","Fed","ECB","BOJ",
                            "해외","국제","달러","엔","유로","위안","수입","수출","환율"]

            def _raw_to_ko(raw, text):
                raw = (raw or "").lower()
                if raw == "society": return "사회"
                if raw == "entertainment": return "트렌드"
                if raw == "economy":
                    t = (text or "")
                    return "해외경제" if any(k.lower() in t.lower() for k in GLOBAL_HINTS) else "국내경제"
                return None

            results_df["cluster_majority_ko"] = results_df.apply(
                lambda r: _raw_to_ko(r.get("cluster_majority_raw"), r.get("fullText") or r.get("content") or ""), axis=1
            )
            
            ts = datetime.utcnow().isoformat().replace(":", "-").replace(".", "-")
            csv_path = self.output_dir / f'clustering_results_detailed_{ts}.csv'
            results_df.to_csv(csv_path, index=False, encoding='utf-8')
            
            if self.cluster_analysis:
                summary_path = self.output_dir / f'cluster_summary_{ts}.json'
                with open(summary_path, 'w', encoding='utf-8') as f:
                    json.dump(self.cluster_analysis, f, ensure_ascii=False, indent=2)
            
            embeddings_data = {
                'articles': self.articles_df.to_dict('records'),
                'embeddings': self.embeddings.tolist(),
                'cluster_labels': self.cluster_labels.tolist(),
                'metadata': {
                    'model': self.config['model_name'],
                    'method': self.best_method,
                    'dimensions': self.embeddings.shape[1],
                    'total_articles': len(self.articles_df),
                    'timestamp': datetime.now().isoformat()
                }
            }
            
            embeddings_path = self.output_dir / f'embeddings_and_clusters_{ts}.json'
            with open(embeddings_path, 'w', encoding='utf-8') as f:
                json.dump(embeddings_data, f, ensure_ascii=False, indent=2)
            print(f"   ✅ 임베딩 데이터: {embeddings_path}")
        except Exception as e:
            print(f"   ❌ 저장 실패: {e}")
    
    def run_full_pipeline(self, news_file_path: str) -> bool:
        print("🚀 KoSimCSE 뉴스 클러스터링 파이프라인 시작\n")
        if not self.load_model():
            return False
        if not self.load_news_data(news_file_path):
            return False
        if not self.generate_embeddings():
            return False
        clustering_results = self.run_clustering()
        if not clustering_results:
            return False
        self.analyze_clusters()
        self.calculate_metrics()
        self.save_results()
        print(f"\n✅ 파이프라인 완료!")
        print(f"📂 결과 위치: {self.output_dir}")
        return True

def main():
    NEWS_DIR = Path(__file__).resolve().parents[2] / "model" / "results" / "collect_results"
    latest = max(NEWS_DIR.glob("news_collected_*h_*.json"), key=lambda p: p.stat().st_mtime)
    news_file_path = str(latest)
    print("Using:", news_file_path)

    config = {
        'model_name': 'BM-K/KoSimCSE-roberta-multitask',
        'batch_size': 16,
        'min_text_length': 50,
        'output_dir': str(Path(__file__).resolve().parents[2] / "model" / "results" / "cluster_results"),
        'save_visualizations': True,
        'clustering_methods': ['HDBSCAN', 'K-Means', 'DBSCAN']
    }

    pipeline = KoSimCSENewsPipeline(config)
    success = pipeline.run_full_pipeline(news_file_path)

    if success:
        print("\n🎉 모든 작업이 성공적으로 완료되었습니다!")
    else:
        print("\n❌ 파이프라인 실행 중 오류가 발생했습니다.")

if __name__ == "__main__":
    main()
