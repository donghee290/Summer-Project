import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict
import warnings
import logging

# Silence tokenizers fork warning
import os; os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, adjusted_rand_score
import hdbscan
import matplotlib.pyplot as plt
from collections import Counter
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

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
                'min_cluster_size': 20,
                'min_samples': 8,
                'metric': 'euclidean',
                'cluster_selection_epsilon': 0.25
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
            'use_time_bucket': True,
            'time_bucket_hours': 6,
            'use_near_duplicate_merge': True,
            'ndup_vector': 'char',  # 'char' or 'word'
            'ndup_char_ngram_min': 3,
            'ndup_char_ngram_max': 5,
            'ndup_word_ngram_min': 1,
            'ndup_word_ngram_max': 2,
            'ndup_threshold': 0.92,
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

    # ===== Time bucketing & near-duplicate helpers =====
    def _parse_pubdate(self, s: str):
        try:
            dt = pd.to_datetime(s, utc=True, errors='coerce')
            return dt
        except Exception:
            return pd.NaT

    def _add_time_bucket(self):
        if self.articles_df is None or 'pubDate' not in self.articles_df.columns:
            return
        self.articles_df['published_at'] = self.articles_df['pubDate'].apply(self._parse_pubdate)
        hours = int(self.config.get('time_bucket_hours', 6))
        self.articles_df['event_bucket'] = self.articles_df['published_at'].dt.floor(f'{hours}H')

    def _normalize_for_dup(self, text: str) -> str:
        if not isinstance(text, str):
            return ''
        t = text
        t = re.sub(r'[\[\(\{][^\]\)\}]{0,30}[\]\)\}]', ' ', t)
        t = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', ' ', t)
        t = re.sub(r'©|무단전재|재배포|기자|사진=|연합뉴스|뉴스1', ' ', t)
        t = re.sub(r'\s+', ' ', t).strip().lower()
        return t

    def _merge_near_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        texts = (df['fullText']
                 .fillna('')
                 .apply(self._normalize_for_dup)
                 .tolist())
        vec_mode = str(self.config.get('ndup_vector', 'char'))
        if vec_mode == 'word':
            v = TfidfVectorizer(ngram_range=(int(self.config.get('ndup_word_ngram_min', 1)),
                                             int(self.config.get('ndup_word_ngram_max', 2))),
                                min_df=1, max_df=1.0)
        else:
            v = TfidfVectorizer(analyzer='char',
                                ngram_range=(int(self.config.get('ndup_char_ngram_min', 3)),
                                             int(self.config.get('ndup_char_ngram_max', 5))),
                                min_df=1, max_df=1.0)
        X = v.fit_transform(texts)
        sim = cosine_similarity(X, dense_output=False)
        thr = float(self.config.get('ndup_threshold', 0.92))

        n = df.shape[0]
        adj = [[] for _ in range(n)]
        coo = sim.tocoo()
        for i, j, val in zip(coo.row, coo.col, coo.data):
            if i >= j:
                continue
            if val >= thr:
                adj[i].append(j)
                adj[j].append(i)

        visited = [False] * n
        groups = []
        for i in range(n):
            if visited[i]:
                continue
            stack = [i]
            visited[i] = True
            comp = [i]
            while stack:
                u = stack.pop()
                for vtx in adj[u]:
                    if not visited[vtx]:
                        visited[vtx] = True
                        stack.append(vtx)
                        comp.append(vtx)
            groups.append(comp)

        reps = []
        for comp in groups:
            sub = df.iloc[comp]
            rep_idx = sub['textLength'].astype(float).fillna(0).values.argmax()
            rep_row = sub.iloc[rep_idx].copy()
            rep_row['dup_count'] = int(len(comp))
            rep_row['merged_indices'] = comp
            merged_full = sub.loc[sub['textLength'].astype(float).idxmax(), 'fullText']
            rep_row['fullText_merged'] = merged_full if isinstance(merged_full, str) else rep_row.get('fullText', '')
            reps.append(rep_row)

        merged_df = pd.DataFrame(reps).reset_index(drop=True)
        return merged_df

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

            # === (1) Time bucket enrichment ===
            if self.config.get('use_time_bucket', True):
                self._add_time_bucket()

            # === (2) Near-duplicate merge (super-doc compression) ===
            if self.config.get('use_near_duplicate_merge', True):
                before = len(self.articles_df)
                self.articles_df = self._merge_near_duplicates(self.articles_df)
                after = len(self.articles_df)
                print(f"🔁 근접중복 병합: {before} → {after} 문서 (압축 비율 {(1 - after/max(before,1)):.1%})")

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
            texts = (self.articles_df['fullText_merged']
                     if 'fullText_merged' in self.articles_df.columns
                     else self.articles_df['fullText']).tolist()
            self.embeddings = self.model.encode(
                texts,
                batch_size=self.config['batch_size'],
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
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
                n_categories = len(self.articles_df['category'].unique())
                optimal_k = min(n_categories + 2, 15)
                kmeans = KMeans(n_clusters=optimal_k, **self.config['kmeans_params'])
                labels = kmeans.fit_predict(self.embeddings)
                results['K-Means'] = labels
                score = silhouette_score(self.embeddings, labels)
                scores['K-Means'] = score
                print(f"   ✅ 완료: {optimal_k}개 클러스터, 실루엣 {score:.3f}")
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
            print(f"\n🎯 최적 방법: {self.best_method} (실루엣 계수: {scores[self.best_method]:.3f})")
        elif results:
            if 'HDBSCAN' in results:
                self.best_method = 'HDBSCAN'
                self.cluster_labels = results['HDBSCAN']
            else:
                self.best_method = list(results.keys())[0]
                self.cluster_labels = results[self.best_method]
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
    
    def save_results(self):
        print(f"\n💾 결과 저장 중...")
        if self.articles_df is None or self.cluster_labels is None:
            print("❌ 저장할 결과가 없습니다.")
            return
        try:
            results_df = self.articles_df.copy()
            results_df['cluster'] = self.cluster_labels
            results_df['method'] = self.best_method

            # Attach time bucket & near-duplicate info when available
            if 'event_bucket' in results_df.columns:
                results_df['event_bucket'] = results_df['event_bucket']
            if 'dup_count' in results_df.columns:
                results_df['dup_count'] = results_df['dup_count']
            if 'merged_indices' in results_df.columns:
                results_df['merged_indices'] = results_df['merged_indices']
            if 'fullText_merged' in results_df.columns:
                results_df['fullText_merged'] = results_df['fullText_merged']

            ts = datetime.utcnow().isoformat().replace(":", "-").replace(".", "-")
            csv_path = self.output_dir / f'clustering_results_detailed_{ts}.csv'
            results_df.to_csv(csv_path, index=False, encoding='utf-8')

            if self.cluster_analysis:
                summary_path = self.output_dir / f'cluster_summary_{ts}.json'
                with open(summary_path, 'w', encoding='utf-8') as f:
                    json.dump(self.cluster_analysis, f, ensure_ascii=False, indent=2)
                print(f"   ✅ 클러스터 요약: {summary_path}")

            # --- Make articles JSON-serializable (convert Timestamp/NaT etc.) ---
            safe_articles_df = self.articles_df.copy()
            def _json_safe(x):
                if isinstance(x, (pd.Timestamp, datetime)):
                    return x.isoformat() if not pd.isna(x) else None
                return x
            safe_articles_df = safe_articles_df.applymap(_json_safe)

            embeddings_data = {
                'articles': safe_articles_df.to_dict('records'),
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
            embeddings_data = convert_numpy_types(embeddings_data)

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
    latest = max(NEWS_DIR.glob("news_colletced_*h_*.json"), key=lambda p: p.stat().st_mtime)
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
