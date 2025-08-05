# kosimcse_full_pipeline.py
import os
import json
import pandas as pd
import numpy as np
import warnings
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# ML/클러스터링 라이브러리
try:
    from sentence_transformers import SentenceTransformer
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.metrics import silhouette_score, adjusted_rand_score
    from sklearn.decomposition import PCA
    from sklearn.manifold import TSNE
    import hdbscan
    import matplotlib.pyplot as plt
    import seaborn as sns
    from collections import Counter
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 필요한 패키지가 설치되지 않았습니다: {e}")
    print("다음 명령어로 설치하세요:")
    print("pip install sentence-transformers pandas numpy scikit-learn hdbscan matplotlib seaborn tqdm")
    exit(1)

# 경고 메시지 숨기기
warnings.filterwarnings('ignore')
logging.getLogger('sentence_transformers').setLevel(logging.ERROR)

# 한글 폰트 설정
plt.rcParams['font.family'] = ['AppleGothic', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

class KoSimCSENewsPipeline:
    """KoSimCSE를 사용한 한국어 뉴스 임베딩 및 클러스터링 통합 파이프라인"""
    
    def __init__(self, config: Dict = None):
        """
        설정 초기화
        
        Args:
            config: 파이프라인 설정 딕셔너리
        """
        # 기본 설정
        self.config = {
            'model_name': 'BM-K/KoSimCSE-roberta-multitask',
            'batch_size': 32,
            'min_text_length': 100,
            'min_title_length': 10,
            'max_text_length': 1000,
            'clustering_methods': ['HDBSCAN', 'K-Means', 'DBSCAN'],
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
            'output_dir': 'kosimcse_results',
            'save_visualizations': True
        }
        
        # 사용자 설정으로 업데이트
        if config:
            self.config.update(config)
        
        # 상태 변수
        self.model = None
        self.articles_df = None
        self.embeddings = None
        self.cluster_labels = None
        self.best_method = None
        self.cluster_analysis = None
        
        # 출력 디렉토리 생성
        self.output_dir = Path(self.config['output_dir'])
        self.output_dir.mkdir(exist_ok=True)
        
        print(f"🚀 KoSimCSE 뉴스 클러스터링 파이프라인 초기화")
        print(f"   출력 디렉토리: {self.output_dir}")
    
    def check_dependencies(self) -> bool:
        """필요한 패키지 설치 확인"""
        required_packages = [
            'sentence_transformers', 'sklearn', 'hdbscan', 
            'matplotlib', 'seaborn', 'pandas', 'numpy'
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"❌ 다음 패키지들이 필요합니다: {missing_packages}")
            print("설치 명령어:")
            print("pip install sentence-transformers pandas numpy scikit-learn hdbscan matplotlib seaborn tqdm")
            return False
        
        print("✅ 모든 필요 패키지가 설치되어 있습니다")
        return True
    
    def load_model(self) -> bool:
        """KoSimCSE 모델 로드"""
        print(f"\n🤖 모델 로딩: {self.config['model_name']}")
        
        try:
            self.model = SentenceTransformer(self.config['model_name'])
            print(f"✅ 모델 로드 성공!")
            print(f"   차원: {self.model.get_sentence_embedding_dimension()}")
            return True
            
        except Exception as e:
            print(f"❌ 모델 로딩 실패: {e}")
            return False
    
    def find_news_file(self) -> Optional[str]:
        """뉴스 JSON 파일 자동 탐지"""
        possible_locations = [
            'source/',
            './',
            '../',
            'data/'
        ]
        
        file_patterns = [
            'v3_naver_news_cleaned_1hour_2025-07-29T02-19-57-117Z.json',
            '*naver_news*.json',
            '*news*.json'
        ]
        
        for location in possible_locations:
            location_path = Path(location)
            if location_path.exists():
                for pattern in file_patterns:
                    files = list(location_path.glob(pattern))
                    if files:
                        return str(files[0])
        
        return None
    
    def load_news_data(self, file_path: str = None) -> bool:
        """뉴스 데이터 로드 및 전처리"""
        print(f"\n📊 뉴스 데이터 로딩...")
        
        # 파일 경로 자동 탐지
        if file_path is None:
            file_path = self.find_news_file()
            if file_path is None:
                print("❌ 뉴스 JSON 파일을 찾을 수 없습니다.")
                print("다음 중 하나를 확인하세요:")
                print("- source/v3_naver_news_cleaned_1hour_2025-07-29T02-19-57-117Z.json")
                print("- ./뉴스파일.json")
                return False
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                news_data = json.load(f)
            
            print(f"✅ 파일 로드 성공: {file_path}")
            
            # 데이터 전처리
            articles = []
            category_stats = {}
            
            for category, article_list in news_data['news'].items():
                if not isinstance(article_list, list):
                    continue
                
                for article in article_list:
                    title = article.get('title', '').strip()
                    content = article.get('content', '').strip()
                    full_text = f"{title}. {content}".strip()
                    
                    # 품질 필터링
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
            
            # DataFrame 생성
            self.articles_df = pd.DataFrame(articles)
            
            print(f"✅ 전처리 완료: {len(articles)}개 기사")
            print("카테고리별 분포:")
            for cat, count in category_stats.items():
                print(f"   {cat}: {count}개")
            
            return True
            
        except Exception as e:
            print(f"❌ 데이터 로딩 실패: {e}")
            return False
    
    def generate_embeddings(self) -> bool:
        """KoSimCSE 임베딩 생성"""
        print(f"\n⚡ KoSimCSE 임베딩 생성 중...")
        
        if self.model is None:
            print("❌ 모델이 로드되지 않았습니다.")
            return False
        
        if self.articles_df is None:
            print("❌ 뉴스 데이터가 로드되지 않았습니다.")
            return False
        
        try:
            texts = self.articles_df['fullText'].tolist()
            
            # 배치 처리로 임베딩 생성
            self.embeddings = self.model.encode(
                texts,
                batch_size=self.config['batch_size'],
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True  # SimCSE 표준
            )
            
            print(f"✅ 임베딩 생성 완료! 형태: {self.embeddings.shape}")
            return True
            
        except Exception as e:
            print(f"❌ 임베딩 생성 실패: {e}")
            return False
    
    def run_clustering(self) -> Dict:
        """다양한 클러스터링 알고리즘 실행 및 평가"""
        print(f"\n🔍 클러스터링 알고리즘 실행 중...")
        
        if self.embeddings is None:
            print("❌ 임베딩이 생성되지 않았습니다.")
            return {}
        
        results = {}
        scores = {}
        
        # 1. HDBSCAN
        if 'HDBSCAN' in self.config['clustering_methods']:
            print("1. HDBSCAN 클러스터링...")
            try:
                clusterer = hdbscan.HDBSCAN(**self.config['hdbscan_params'])
                labels = clusterer.fit_predict(self.embeddings)
                results['HDBSCAN'] = labels
                
                # 평가
                valid_mask = labels != -1
                if valid_mask.sum() > 1 and len(set(labels[valid_mask])) > 1:
                    score = silhouette_score(self.embeddings[valid_mask], labels[valid_mask])
                    scores['HDBSCAN'] = score
                
                n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                n_noise = np.sum(labels == -1)
                print(f"   ✅ 완료: {n_clusters}개 클러스터, 노이즈 {n_noise}개")
                
            except Exception as e:
                print(f"   ❌ HDBSCAN 실패: {e}")
        
        # 2. K-Means
        if 'K-Means' in self.config['clustering_methods']:
            print("2. K-Means 클러스터링...")
            try:
                n_categories = len(self.articles_df['category'].unique())
                optimal_k = min(n_categories + 2, 15)
                
                kmeans = KMeans(n_clusters=optimal_k, **self.config['kmeans_params'])
                labels = kmeans.fit_predict(self.embeddings)
                results['K-Means'] = labels
                
                # 평가
                score = silhouette_score(self.embeddings, labels)
                scores['K-Means'] = score
                
                print(f"   ✅ 완료: {optimal_k}개 클러스터, 실루엣 {score:.3f}")
                
            except Exception as e:
                print(f"   ❌ K-Means 실패: {e}")
        
        # 3. DBSCAN
        if 'DBSCAN' in self.config['clustering_methods']:
            print("3. DBSCAN 클러스터링...")
            try:
                dbscan = DBSCAN(**self.config['dbscan_params'])
                labels = dbscan.fit_predict(self.embeddings)
                results['DBSCAN'] = labels
                
                # 평가
                valid_mask = labels != -1
                if valid_mask.sum() > 1 and len(set(labels[valid_mask])) > 1:
                    score = silhouette_score(self.embeddings[valid_mask], labels[valid_mask])
                    scores['DBSCAN'] = score
                
                n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                n_noise = np.sum(labels == -1)
                print(f"   ✅ 완료: {n_clusters}개 클러스터, 노이즈 {n_noise}개")
                
            except Exception as e:
                print(f"   ❌ DBSCAN 실패: {e}")
        
        # 최적 방법 선택
        if scores:
            self.best_method = max(scores, key=scores.get)
            self.cluster_labels = results[self.best_method]
            print(f"\n🎯 최적 방법: {self.best_method} (실루엣 계수: {scores[self.best_method]:.3f})")
        elif results:
            # 스코어가 없으면 HDBSCAN 우선
            if 'HDBSCAN' in results:
                self.best_method = 'HDBSCAN'
                self.cluster_labels = results['HDBSCAN']
            else:
                self.best_method = list(results.keys())[0]
                self.cluster_labels = results[self.best_method]
            print(f"\n🎯 선택된 방법: {self.best_method}")
        
        return results
    
    def analyze_clusters(self) -> Dict:
        """클러스터 상세 분석"""
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
                # 카테고리 분포
                cat_dist = cluster_articles['category'].value_counts()
                dominant_cat = cat_dist.index[0] if len(cat_dist) > 0 else 'Unknown'
                purity = (cat_dist.iloc[0] / len(cluster_articles)) if len(cat_dist) > 0 else 0
                
                # 대표 기사들
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
        
        # 결과 출력
        print(f"총 {len(unique_clusters)}개 클러스터:")
        for cid, info in analysis.items():
            if cid == -1:
                print(f"  노이즈: {info['size']}개")
            else:
                print(f"\n  클러스터 {cid}: {info['size']}개 기사")
                print(f"    주도 카테고리: {info['dominant_category']} (순도: {info['purity']:.2f})")
                print(f"    대표 제목: {info['representative_titles'][0][:50]}...")
        
        self.cluster_analysis = analysis
        return analysis
    
    def calculate_metrics(self) -> Dict:
        """클러스터링 품질 지표 계산"""
        print(f"\n📏 품질 지표 계산 중...")
        
        if self.cluster_labels is None:
            return {}
        
        # 실제 카테고리를 숫자로 변환
        category_to_id = {cat: i for i, cat in enumerate(self.articles_df['category'].unique())}
        true_labels = np.array([category_to_id[cat] for cat in self.articles_df['category']])
        
        metrics = {}
        
        # 노이즈 제외한 평가
        valid_mask = self.cluster_labels != -1
        if valid_mask.sum() > 0:
            valid_pred = self.cluster_labels[valid_mask]
            valid_true = true_labels[valid_mask]
            valid_embeddings = self.embeddings[valid_mask]
            
            if len(set(valid_pred)) > 1:
                # 실루엣 계수
                silhouette = silhouette_score(valid_embeddings, valid_pred)
                metrics['silhouette'] = silhouette
                
                # 조정된 랜드 지수
                ari = adjusted_rand_score(valid_true, valid_pred)
                metrics['ari'] = ari
                
                # 순도 계산
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
                
                # 기타 지표
                metrics['n_clusters'] = len(set(valid_pred))
                metrics['noise_ratio'] = (self.cluster_labels == -1).sum() / len(self.cluster_labels)
                
                # 결과 출력
                print(f"  실루엣 계수: {silhouette:.3f}")
                print(f"  조정된 랜드 지수: {ari:.3f}")
                print(f"  전체 순도: {overall_purity:.3f}")
                print(f"  클러스터 수: {len(set(valid_pred))}")
                print(f"  노이즈 비율: {metrics['noise_ratio']:.1%}")
        
        return metrics
    
    def create_visualizations(self):
        """클러스터링 결과 시각화"""
        if not self.config['save_visualizations'] or self.embeddings is None:
            return
        
        print(f"\n🎨 시각화 생성 중...")
        
        try:
            # t-SNE 차원 축소
            print("   t-SNE 차원 축소...")
            tsne = TSNE(n_components=2, random_state=42, perplexity=30)
            embeddings_2d = tsne.fit_transform(self.embeddings)
            
            # 플롯 생성
            fig, axes = plt.subplots(2, 2, figsize=(16, 12))
            
            # 1. 클러스터별 색상
            if self.cluster_labels is not None:
                scatter1 = axes[0, 0].scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], 
                                            c=self.cluster_labels, cmap='tab20', alpha=0.7, s=30)
                axes[0, 0].set_title(f'{self.best_method} 클러스터링 결과')
                axes[0, 0].set_xlabel('t-SNE 1')
                axes[0, 0].set_ylabel('t-SNE 2')
            
            # 2. 실제 카테고리별
            category_ids = pd.Categorical(self.articles_df['category']).codes
            scatter2 = axes[0, 1].scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], 
                                        c=category_ids, cmap='Set3', alpha=0.7, s=30)
            axes[0, 1].set_title('실제 카테고리')
            axes[0, 1].set_xlabel('t-SNE 1')
            axes[0, 1].set_ylabel('t-SNE 2')
            
            # 3. 텍스트 길이별
            text_lengths = self.articles_df['textLength'].values
            scatter3 = axes[1, 0].scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], 
                                        c=text_lengths, cmap='viridis', alpha=0.7, s=30)
            axes[1, 0].set_title('텍스트 길이별')
            axes[1, 0].set_xlabel('t-SNE 1')
            axes[1, 0].set_ylabel('t-SNE 2')
            plt.colorbar(scatter3, ax=axes[1, 0])
            
            # 4. 클러스터 크기 분포
            if self.cluster_labels is not None:
                cluster_sizes = pd.Series(self.cluster_labels).value_counts().sort_index()
                axes[1, 1].bar(range(len(cluster_sizes)), cluster_sizes.values)
                axes[1, 1].set_title('클러스터별 기사 수')
                axes[1, 1].set_xlabel('클러스터 ID')
                axes[1, 1].set_ylabel('기사 수')
            
            plt.tight_layout()
            
            # 저장
            viz_path = self.output_dir / 'clustering_visualization.png'
            plt.savefig(viz_path, dpi=300, bbox_inches='tight')
            print(f"   ✅ 시각화 저장: {viz_path}")
            
            plt.close()
            
        except Exception as e:
            print(f"   ❌ 시각화 실패: {e}")
    
    def save_results(self):
        """결과 저장"""
        print(f"\n💾 결과 저장 중...")
        
        if self.articles_df is None or self.cluster_labels is None:
            print("❌ 저장할 결과가 없습니다.")
            return
        
        try:
            # 1. 상세 결과 CSV
            results_df = self.articles_df.copy()
            results_df['cluster'] = self.cluster_labels
            results_df['method'] = self.best_method
            
            csv_path = self.output_dir / 'clustering_results_detailed.csv'
            results_df.to_csv(csv_path, index=False, encoding='utf-8')
            print(f"   ✅ 상세 결과: {csv_path}")
            
            # 2. 클러스터 요약 JSON
            if self.cluster_analysis:
                summary_path = self.output_dir / 'cluster_summary.json'
                with open(summary_path, 'w', encoding='utf-8') as f:
                    json.dump(self.cluster_analysis, f, ensure_ascii=False, indent=2)
                print(f"   ✅ 클러스터 요약: {summary_path}")
            
            # 3. 임베딩 데이터
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
            
            embeddings_path = self.output_dir / 'embeddings_and_clusters.json'
            with open(embeddings_path, 'w', encoding='utf-8') as f:
                json.dump(embeddings_data, f, ensure_ascii=False, indent=2)
            print(f"   ✅ 임베딩 데이터: {embeddings_path}")
            
        except Exception as e:
            print(f"   ❌ 저장 실패: {e}")
    
    def run_similarity_test(self):
        """유사도 테스트"""
        print(f"\n🧪 유사도 테스트...")
        
        if self.model is None or self.embeddings is None:
            return
        
        test_queries = [
            '국내 경제',
            '사회',
            '연예',
            '국제 경제'
        ]
        
        for query in test_queries:
            print(f"\n'{query}' 관련 기사 Top 3:")
            
            # 쿼리 임베딩
            query_embedding = self.model.encode([query], normalize_embeddings=True)[0]
            
            # 유사도 계산
            similarities = np.dot(self.embeddings, query_embedding)
            top_indices = np.argsort(similarities)[-3:][::-1]
            
            for i, idx in enumerate(top_indices):
                title = self.articles_df.iloc[idx]['title']
                category = self.articles_df.iloc[idx]['category']
                print(f"  {i+1}. [{similarities[idx]:.4f}] {title[:50]}... ({category})")
    
    def run_full_pipeline(self, news_file_path: str = None) -> bool:
        """전체 파이프라인 실행"""
        print("🚀 KoSimCSE 뉴스 클러스터링 파이프라인 시작\n")
        
        # 1. 의존성 확인
        if not self.check_dependencies():
            return False
        
        # 2. 모델 로드
        if not self.load_model():
            return False
        
        # 3. 뉴스 데이터 로드
        if not self.load_news_data(news_file_path):
            return False
        
        # 4. 임베딩 생성
        if not self.generate_embeddings():
            return False
        
        # 5. 클러스터링
        clustering_results = self.run_clustering()
        if not clustering_results:
            return False
        
        # 6. 클러스터 분석
        self.analyze_clusters()
        
        # 7. 품질 평가
        metrics = self.calculate_metrics()
        
        # 8. 시각화
        self.create_visualizations()
        
        # 9. 결과 저장
        self.save_results()
        
        # 10. 유사도 테스트
        self.run_similarity_test()
        
        print(f"\n✅ 파이프라인 완료!")
        print(f"📂 결과 위치: {self.output_dir}")
        
        if metrics:
            print(f"\n🎯 최종 성능:")
            print(f"   방법: {self.best_method}")
            if 'silhouette' in metrics:
                print(f"   실루엣 계수: {metrics['silhouette']:.3f}")
            if 'purity' in metrics:
                print(f"   순도: {metrics['purity']:.3f}")
            if 'n_clusters' in metrics:
                print(f"   클러스터 수: {metrics['n_clusters']}")
        
        return True

def main():
    """메인 실행 함수"""

    # 명확하게 사용할 파일 경로를 지정
    news_file_path = './sample_results/v3_naver_news_cleaned_1hour_2025-08-05T01-50-18-041Z.json'

    config = {
        'model_name': 'BM-K/KoSimCSE-roberta-multitask',
        'batch_size': 16,
        'min_text_length': 50,
        'output_dir': 'kosimcse_results',
        'save_visualizations': True,
        'clustering_methods': ['HDBSCAN', 'K-Means', 'DBSCAN']
    }

    pipeline = KoSimCSENewsPipeline(config)
    # 여기서 news_file_path 인자를 명확하게 넘깁니다.
    success = pipeline.run_full_pipeline(news_file_path)

    if success:
        print("\n🎉 모든 작업이 성공적으로 완료되었습니다!")
    else:
        print("\n❌ 파이프라인 실행 중 오류가 발생했습니다.")


if __name__ == "__main__":
    main()

