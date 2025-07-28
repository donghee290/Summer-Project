# clustering.py
# Python에서 HDBSCAN을 사용한 뉴스 기사 클러스터링

import pandas as pd
import numpy as np
import json
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import seaborn as sns
import warnings

# HDBSCAN import with error handling
try:
    from sklearn.cluster import HDBSCAN
    print("✓ sklearn의 HDBSCAN을 사용합니다.")
except ImportError:
    try:
        import hdbscan
        HDBSCAN = hdbscan.HDBSCAN
        print("✓ hdbscan 패키지를 사용합니다.")
    except ImportError:
        print("❌ HDBSCAN을 찾을 수 없습니다.")
        print("다음 중 하나를 설치해주세요:")
        print("  pip install scikit-learn>=1.3.0  (권장)")
        print("  pip install hdbscan")
        exit(1)

warnings.filterwarnings('ignore')

def load_embeddings_from_nodejs():
    """Node.js에서 생성한 임베딩 데이터 로드"""
    
    print("=== 1단계: 임베딩 데이터 로드 ===")
    
    # 방법 1: CSV 파일에서 로드
    try:
        print("CSV 파일에서 데이터 로드 시도...")
        df = pd.read_csv('embeddings_for_clustering.csv')
        
        print(f"  - 기사 개수: {len(df)}개")
        print(f"  - 컬럼: {list(df.columns)}")
        
        # 임베딩 문자열을 numpy 배열로 변환
        print("  - 임베딩 벡터 변환 중...")
        embeddings = []
        
        for i, embedding_str in enumerate(df['embedding']):
            if i % 100 == 0:
                print(f"    진행률: {i+1}/{len(df)}")
            
            try:
                embedding = [float(x) for x in embedding_str.split(',')]
                embeddings.append(embedding)
            except:
                print(f"    경고: {i}번째 임베딩 변환 실패, 건너뜀")
                continue
        
        embeddings = np.array(embeddings)
        
        print(f"✓ CSV에서 로드 완료: {len(df)}개 기사, {embeddings.shape[1]}차원 임베딩")
        
        # 카테고리별 분포 출력
        if 'category' in df.columns:
            print("  카테고리별 분포:")
            category_counts = df['category'].value_counts()
            for cat, count in category_counts.items():
                print(f"    - {cat}: {count}개")
        
        return df, embeddings
    
    except FileNotFoundError:
        print("❌ CSV 파일을 찾을 수 없습니다.")
    except Exception as e:
        print(f"❌ CSV 로드 중 오류: {e}")
    
    # 방법 2: JSON 파일에서 직접 로드
    try:
        print("JSON 파일에서 데이터 로드 시도...")
        with open('embeddings_array.json', 'r') as f:
            embeddings = np.array(json.load(f))
        
        print(f"✓ JSON에서 로드 완료: {embeddings.shape[0]}개 기사, {embeddings.shape[1]}차원 임베딩")
        print("⚠️  기사 정보가 없어 클러스터 분석이 제한됩니다.")
        return None, embeddings
    
    except FileNotFoundError:
        print("❌ JSON 파일도 찾을 수 없습니다.")
    except Exception as e:
        print(f"❌ JSON 로드 중 오류: {e}")
    
    # 파일이 없는 경우 안내
    print("\n파일을 찾을 수 없습니다. 다음을 확인해주세요:")
    print("1. Node.js 스크립트(embedding_script.js)를 먼저 실행했는지 확인")
    print("2. 현재 디렉토리에 다음 파일들이 있는지 확인:")
    print("   - embeddings_for_clustering.csv")
    print("   - embeddings_array.json")
    
    import os
    files = [f for f in os.listdir('.') if f.endswith(('.csv', '.json'))]
    if files:
        print("\n현재 디렉토리의 관련 파일들:")
        for file in files:
            print(f"   - {file}")
    
    raise FileNotFoundError("임베딩 파일을 찾을 수 없습니다.")

def perform_hdbscan_clustering(embeddings, min_cluster_size=3, min_samples=2):
    """HDBSCAN을 사용한 클러스터링"""
    
    print(f"\n=== 2단계: HDBSCAN 클러스터링 ===")
    print(f"파라미터:")
    print(f"  - 최소 클러스터 크기: {min_cluster_size}")
    print(f"  - 최소 샘플 수: {min_samples}")
    print(f"  - 거리 측정: euclidean")
    
    print("HDBSCAN 클러스터링 실행 중...")
    
    # HDBSCAN 클러스터링
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,  # 최소 클러스터 크기
        min_samples=min_samples,           # 최소 샘플 수  
        metric='euclidean',                # 거리 측정 방식
        cluster_selection_method='eom'     # 클러스터 선택 방법
    )
    
    cluster_labels = clusterer.fit_predict(embeddings)
    
    # 클러스터링 결과 분석
    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    n_noise = list(cluster_labels).count(-1)
    n_clustered = len(cluster_labels) - n_noise
    
    print(f"\n클러스터링 결과:")
    print(f"  - 발견된 클러스터 개수: {n_clusters}개")
    print(f"  - 클러스터에 속한 기사: {n_clustered}개 ({n_clustered/len(cluster_labels)*100:.1f}%)")
    print(f"  - 노이즈로 분류된 기사: {n_noise}개 ({n_noise/len(cluster_labels)*100:.1f}%)")
    
    # 각 클러스터별 크기
    if n_clusters > 0:
        print(f"\n클러스터별 크기:")
        cluster_sizes = {}
        for label in cluster_labels:
            if label >= 0:
                cluster_sizes[label] = cluster_sizes.get(label, 0) + 1
        
        for cluster_id in sorted(cluster_sizes.keys()):
            print(f"  - 클러스터 {cluster_id}: {cluster_sizes[cluster_id]}개 기사")
    
    return cluster_labels, clusterer

def visualize_clusters(embeddings, cluster_labels, method='tsne'):
    """클러스터링 결과를 2D로 시각화"""
    
    print(f"\n=== 3단계: 클러스터링 결과 시각화 ({method.upper()}) ===")
    
    if method == 'pca':
        print("PCA를 사용한 차원 축소...")
        reducer = PCA(n_components=2, random_state=42)
    else:  # tsne
        print("t-SNE를 사용한 차원 축소...")
        print("  주의: t-SNE는 시간이 오래 걸릴 수 있습니다...")
        reducer = TSNE(n_components=2, random_state=42, perplexity=30)
    
    # 차원 축소
    embeddings_2d = reducer.fit_transform(embeddings)
    print("✓ 차원 축소 완료!")
    
    # 시각화
    print("시각화 생성 중...")
    plt.figure(figsize=(12, 8))
    plt.rcParams['font.family'] = ['DejaVu Sans', 'Malgun Gothic', 'AppleGothic']  # 한글 폰트 설정
    
    # 각 클러스터별로 다른 색상으로 표시
    unique_labels = set(cluster_labels)
    n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
    
    if n_clusters > 0:
        colors = plt.cm.Spectral(np.linspace(0, 1, len(unique_labels)))
    else:
        colors = ['black']
    
    for k, col in zip(unique_labels, colors):
        if k == -1:
            # 노이즈 포인트는 검은색으로
            col = [0, 0, 0, 1]
            marker = 'x'
            label = '노이즈'
        else:
            marker = 'o'
            label = f'클러스터 {k}'
        
        class_member_mask = (cluster_labels == k)
        xy = embeddings_2d[class_member_mask]
        
        if len(xy) > 0:
            plt.scatter(xy[:, 0], xy[:, 1], c=[col], marker=marker, 
                       s=50, alpha=0.7, label=label)
    
    plt.title(f'뉴스 기사 클러스터링 결과 ({method.upper()})', fontsize=14, fontweight='bold')
    plt.xlabel('첫 번째 차원', fontsize=12)
    plt.ylabel('두 번째 차원', fontsize=12)
    
    if n_clusters > 0:
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    
    plt.tight_layout()
    
    # 파일 저장
    filename = f'news_clustering_{method}.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"✓ 시각화 저장: {filename}")
    
    plt.show()
    
    return embeddings_2d

def analyze_clusters(df, cluster_labels):
    """각 클러스터의 특성 분석"""
    
    print(f"\n=== 4단계: 클러스터 특성 분석 ===")
    
    if df is None:
        print("❌ 기사 정보가 없어 클러스터 분석을 수행할 수 없습니다.")
        print("CSV 파일에서 데이터를 로드하면 더 자세한 분석이 가능합니다.")
        return None
    
    # 클러스터 라벨을 데이터프레임에 추가
    df_analysis = df.copy()
    df_analysis['cluster'] = cluster_labels
    
    print(f"분석 대상: {len(df_analysis)}개 기사")
    
    # 각 클러스터별 통계
    unique_clusters = sorted(set(cluster_labels))
    
    for cluster_id in unique_clusters:
        if cluster_id == -1:
            print(f"\n📌 노이즈 포인트: {sum(cluster_labels == -1)}개")
            noise_data = df_analysis[df_analysis['cluster'] == -1]
            if 'category' in noise_data.columns:
                noise_categories = noise_data['category'].value_counts()
                print("   카테고리 분포:")
                for cat, count in noise_categories.head(3).items():
                    print(f"     - {cat}: {count}개")
            continue
        
        cluster_data = df_analysis[df_analysis['cluster'] == cluster_id]
        print(f"\n📌 클러스터 {cluster_id}: {len(cluster_data)}개 기사")
        
        # 카테고리별 분포
        if 'category' in cluster_data.columns:
            category_dist = cluster_data['category'].value_counts()
            print("   카테고리 분포:")
            for cat, count in category_dist.items():
                percentage = count / len(cluster_data) * 100
                print(f"     - {cat}: {count}개 ({percentage:.1f}%)")
        
        # 대표 기사 제목 (처음 5개)
        print("   대표 기사:")
        for i, title in enumerate(cluster_data['title'].head(5)):
            print(f"     {i+1}. {title[:80]}{'...' if len(title) > 80 else ''}")
        
        # 평균 기사 길이
        if 'contentLength' in cluster_data.columns:
            avg_length = cluster_data['contentLength'].mean()
            print(f"   평균 기사 길이: {avg_length:.0f}자")
    
    return df_analysis

def save_results(df_with_clusters, cluster_labels, clusterer):
    """결과 저장"""
    
    print(f"\n=== 5단계: 결과 저장 ===")
    
    # 클러스터링된 데이터프레임 저장
    if df_with_clusters is not None:
        output_file = 'clustered_news_results.csv'
        df_with_clusters.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✓ 클러스터링 결과: {output_file}")
    
    # 클러스터 정보 JSON으로 저장
    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    n_noise = list(cluster_labels).count(-1)
    
    cluster_info = {
        'summary': {
            'total_articles': len(cluster_labels),
            'n_clusters': n_clusters,
            'n_clustered': len(cluster_labels) - n_noise,
            'n_noise': n_noise,
            'clustering_ratio': (len(cluster_labels) - n_noise) / len(cluster_labels)
        },
        'cluster_sizes': {},
        'parameters': {
            'algorithm': 'HDBSCAN',
            'min_cluster_size': 3,
            'min_samples': 2,
            'metric': 'euclidean',
            'cluster_selection_method': 'eom'
        },
        'cluster_labels': cluster_labels.tolist()
    }
    
    # 각 클러스터 크기 계산
    for label in cluster_labels:
        if label >= 0:
            cluster_info['cluster_sizes'][str(label)] = cluster_info['cluster_sizes'].get(str(label), 0) + 1
    
    with open('cluster_info.json', 'w', encoding='utf-8') as f:
        json.dump(cluster_info, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 클러스터 정보: cluster_info.json")
    print(f"✓ 시각화 이미지: news_clustering_tsne.png")

def main():
    """메인 실행 함수"""
    
    print("🚀 뉴스 기사 HDBSCAN 클러스터링 시작")
    print("=" * 50)
    
    try:
        # 1. Node.js에서 생성한 임베딩 로드
        df, embeddings = load_embeddings_from_nodejs()
        
        # 데이터 검증
        if embeddings.shape[0] == 0:
            print("❌ 임베딩 데이터가 비어있습니다.")
            return
        
        if embeddings.shape[0] < 3:
            print("❌ 클러스터링하기에는 데이터가 너무 적습니다. (최소 3개 필요)")
            return
        
        # 2. HDBSCAN 클러스터링
        cluster_labels, clusterer = perform_hdbscan_clustering(
            embeddings, 
            min_cluster_size=max(3, embeddings.shape[0] // 20),  # 데이터 크기에 따라 동적 조정
            min_samples=2
        )
        
        # 3. 시각화
        embeddings_2d = visualize_clusters(embeddings, cluster_labels, method='tsne')
        
        # 4. 클러스터 분석
        df_with_clusters = analyze_clusters(df, cluster_labels)
        
        # 5. 결과 저장
        save_results(df_with_clusters, cluster_labels, clusterer)
        
        print("\n" + "=" * 50)
        print("🎉 클러스터링 완료!")
        print("\n생성된 파일들:")
        print("  - clustered_news_results.csv (클러스터링 결과)")
        print("  - cluster_info.json (클러스터 통계)")
        print("  - news_clustering_tsne.png (시각화)")
        
        print("\n다음 단계:")
        print("  1. CSV 파일을 열어서 클러스터링 결과 확인")
        print("  2. PNG 이미지에서 클러스터 분포 시각적 확인")
        print("  3. 클러스터별로 기사들의 공통 주제 파악")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        print(f"\n문제 해결 방법:")
        print(f"1. 패키지 설치 확인:")
        print(f"   pip install pandas numpy scikit-learn matplotlib seaborn")
        print(f"   pip install hdbscan  # 또는 scikit-learn>=1.3.0")
        print(f"2. Node.js 스크립트를 먼저 실행했는지 확인")
        print(f"3. 파일 경로와 권한 확인")
        
        import traceback
        print(f"\n상세 오류:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
