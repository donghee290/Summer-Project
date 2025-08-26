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

# --- CATEGORY_TOP3 전용 헬퍼 함수들 ---
TARGET_CATEGORIES = ["국내경제", "해외경제", "사회", "연예"]

ECON_FOREIGN_KEYWORDS = [
    "해외", "국제", "세계", "글로벌", "대외", "대외요인", "IMF", "WB", "WTO", "OECD",
    "미국", "중국", "일본", "유럽", "EU", "유로존", "영국", "독일", "프랑스", "인도",
    "싱가포르", "베트남", "대만", "홍콩", "러시아", "우크라이나", "중동", "UAE", "사우디",
    "Fed", "연준", "FOMC", "ECB", "BOJ", "BOE", "달러", "엔화", "위안화"
]

def normalize_top_category(row: dict) -> str:
    """원본 category와 텍스트를 바탕으로 최종 카테고리를 [국내경제, 해외경제, 사회, 연예] 중 하나로 매핑"""
    raw_cat = str(row.get("category", "")).lower()
    title = str(row.get("title", ""))
    content = str(row.get("content", ""))
    text = f"{title} {content}"

    # economy 분기: 국내/해외
    if "economy" in raw_cat or "경제" in raw_cat:
        if any(kw in text for kw in ECON_FOREIGN_KEYWORDS):
            return "해외경제"
        return "국내경제"

    if "society" in raw_cat or "사회" in raw_cat:
        return "사회"

    if "entertainment" in raw_cat or "연예" in raw_cat or "culture" in raw_cat:
        return "연예"

    # 기타는 사회로 귀속 (보수적 기본값)
    return "사회"


def compute_importance_scores(embeds_cat: np.ndarray, text_lengths: np.ndarray) -> np.ndarray:
    """카테고리 내 대표성(centroid 유사도) + 텍스트 길이 정규화를 합쳐 중요도 산출"""
    if embeds_cat.shape[0] == 0:
        return np.array([])
    centroid = embeds_cat.mean(axis=0, keepdims=True)
    sim = cosine_similarity(embeds_cat, centroid).ravel()  # 0~1 근처

    # 텍스트 길이 정규화 (0~1)
    if len(text_lengths) > 0:
        tl = text_lengths.astype(float)
        tl_norm = (tl - tl.min()) / (tl.max() - tl.min() + 1e-8)
    else:
        tl_norm = np.zeros_like(sim)

    # 가중 평균 (대표성 0.7, 길이 0.3)
    return 0.7 * sim + 0.3 * tl_norm

class KoSimCSENewsPipeline:
    def __init__(self, config: Dict = None):
        self.config = {
            'model_name': 'BM-K/KoSimCSE-roberta-multitask',
            'batch_size': 16,
            'min_text_length': 50,
            'min_title_length': 10,
            'max_text_length': 1000,
            'clustering_methods': ['CATEGORY_TOP3'],
            'hdbscan_params': {
                'min_cluster_size': 20,
                'min_samples': 8,
                'metric': 'cosine',
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
                            'top_category': normalize_top_category({'category': category, 'title': title, 'content': content}),
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
            texts = self.articles_df['fullText'].tolist()
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
        print(f"\n🔍 카테고리 TOP3 선별 모드 실행 중...")
        if self.embeddings is None or self.articles_df is None:
            print("❌ 임베딩 또는 데이터가 준비되지 않았습니다.")
            return {}

        # 최종 클러스터 레이블(정수) 초기화
        labels = np.full(len(self.articles_df), -1, dtype=int)
        cluster_id_counter = 0
        mapping_info = {}

        results = {}

        for cat in TARGET_CATEGORIES:
            df_cat = self.articles_df[self.articles_df['top_category'] == cat]
            if df_cat.empty:
                continue
            idx_cat = df_cat.index.to_numpy()
            embeds_cat = self.embeddings[idx_cat]
            text_len_cat = df_cat['textLength'].to_numpy()

            # 중요도 스코어 계산
            scores = compute_importance_scores(embeds_cat, text_len_cat)
            # 상위 3개 인덱스 선택 (데이터가 적으면 있는 만큼)
            top_k = min(3, len(scores))
            top_idx_local = np.argsort(-scores)[:top_k]
            chosen_global_idx = idx_cat[top_idx_local]

            # 각 선택 기사 주변으로 유사한 기사들을 묶는 간단한 군집(옵션)
            # 여기서는 선택 기사 자신만 포함(대표 기사 3개를 선택) — 필요 시 확장 가능
            for j, g_idx in enumerate(chosen_global_idx):
                labels[g_idx] = cluster_id_counter
                mapping_info[int(cluster_id_counter)] = {
                    'top_category': cat,
                    'anchor_title': self.articles_df.loc[g_idx, 'title']
                }
                cluster_id_counter += 1

        if cluster_id_counter == 0:
            print("❌ 어떤 카테고리에서도 기사를 찾지 못했습니다.")
            return {}

        self.best_method = 'CATEGORY_TOP3'
        self.cluster_labels = labels
        results['CATEGORY_TOP3'] = labels
        print(f"   ✅ 카테고리별 대표 기사 선별 완료: 총 {cluster_id_counter}개 (카테고리당 최대 3개)")
        return results
    
    def analyze_clusters(self) -> Dict:
        print(f"\n📊 클러스터 분석 중...")
        if self.cluster_labels is None:
            print("❌ 클러스터링이 실행되지 않았습니다.")
            return {}

        unique_clusters = sorted(c for c in set(self.cluster_labels) if c != -1)
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
            if len(set(valid_pred)) > 1 and sum((valid_pred == cid).sum() >= 2 for cid in set(valid_pred)) >= 2:
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
            if 'top_category' not in results_df.columns:
                results_df['top_category'] = self.articles_df.get('top_category', pd.Series([None]*len(self.articles_df)))
            results_df['cluster'] = self.cluster_labels
            results_df['method'] = self.best_method
            
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
    print("Mode: CATEGORY_TOP3 (국내경제/해외경제/사회/연예 각 3건 선별)")

    config = {
        'model_name': 'BM-K/KoSimCSE-roberta-multitask',
        'batch_size': 16,
        'min_text_length': 50,
        'output_dir': str(Path(__file__).resolve().parents[2] / "model" / "results" / "cluster_results"),
        'save_visualizations': True,
        'clustering_methods': ['CATEGORY_TOP3']
    }

    pipeline = KoSimCSENewsPipeline(config)
    success = pipeline.run_full_pipeline(news_file_path)

    if success:
        print("\n🎉 모든 작업이 성공적으로 완료되었습니다!")
    else:
        print("\n❌ 파이프라인 실행 중 오류가 발생했습니다.")

if __name__ == "__main__":
    main()
