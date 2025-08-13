import pandas as pd
from collections import Counter, defaultdict
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
import numpy as np

def extract_keywords_and_cluster():
    # CSV 파일 읽기
    df = pd.read_csv('./kosimcse_results/clustering_results_detailed.csv')
    
    # 텍스트 전처리 함수
    def preprocess_text(text):
        if pd.isna(text):
            return ""
        # 한글, 영문, 숫자만 추출
        text = re.sub(r'[^가-힣a-zA-Z0-9\s]', ' ', str(text))
        # 연속된 공백을 하나로
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    # category별로 데이터 그룹화
    category_groups = defaultdict(list)
    
    for category in df['category'].unique():
        category_data = df[df['category'] == category].copy()
        
        # content 텍스트 전처리
        category_data['cleaned_content'] = category_data['content'].apply(preprocess_text)
        
        # 전체 텍스트 결합
        all_text = ' '.join(category_data['cleaned_content'].tolist())
        
        # 키워드 추출 (간단한 단어 빈도 기반)
        words = all_text.split()
        # 2글자 이상의 한글 단어만 추출
        korean_words = [word for word in words if len(word) >= 2 and re.match(r'^[가-힣]+$', word)]
        
        # 키워드 빈도 계산
        word_counts = Counter(korean_words)
        
        # 5개 이상 언급된 키워드 찾기
        frequent_keywords = {word: count for word, count in word_counts.items() if count >= 5}
        
        print(f"\n=== {category.upper()} 카테고리 ===")
        print(f"총 기사 수: {len(category_data)}")
        print(f"5회 이상 언급된 키워드 ({len(frequent_keywords)}개):")
        
        # 빈도순으로 정렬하여 출력
        for word, count in sorted(frequent_keywords.items(), key=lambda x: x[1], reverse=True)[:20]:
            print(f"  {word}: {count}회")
        
        # 해당 키워드들을 포함하는 content들 찾기
        if frequent_keywords:
            keyword_contents = []
            for idx, row in category_data.iterrows():
                content = row['cleaned_content']
                # 빈도 높은 키워드가 포함된 content 찾기
                matching_keywords = []
                for keyword in frequent_keywords.keys():
                    if keyword in content:
                        matching_keywords.append(keyword)
                
                if matching_keywords:
                    keyword_contents.append({
                        'index': idx,
                        'title': row['title'],
                        'content': row['content'][:200] + "..." if len(str(row['content'])) > 200 else row['content'],
                        'matching_keywords': matching_keywords,
                        'keyword_count': len(matching_keywords)
                    })
            
            # 키워드 매칭 수가 많은 순으로 정렬
            keyword_contents.sort(key=lambda x: x['keyword_count'], reverse=True)
            
            print(f"\n키워드 매칭 기사들 (상위 10개):")
            for i, content_info in enumerate(keyword_contents[:10]):
                print(f"\n[{i+1}] {content_info['title']}")
                print(f"매칭 키워드 ({content_info['keyword_count']}개): {', '.join(content_info['matching_keywords'])}")
                print(f"내용: {content_info['content']}")
        
        category_groups[category] = {
            'frequent_keywords': frequent_keywords,
            'matching_contents': keyword_contents if frequent_keywords else []
        }
    
    return category_groups

def advanced_clustering_by_keywords():
    """TF-IDF 기반 고급 클러스터링"""
    df = pd.read_csv('./kosimcse_results/clustering_results_detailed.csv')
    
    # 텍스트 전처리
    def preprocess_for_tfidf(text):
        if pd.isna(text):
            return ""
        text = re.sub(r'[^가-힣a-zA-Z0-9\s]', ' ', str(text))
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    results = {}
    
    for category in df['category'].unique():
        print(f"\n{'='*50}")
        print(f"카테고리: {category.upper()}")
        print(f"{'='*50}")
        
        category_data = df[df['category'] == category].copy()
        category_data['processed_content'] = category_data['content'].apply(preprocess_for_tfidf)
        
        # TF-IDF 벡터화
        vectorizer = TfidfVectorizer(
            max_features=100,  # 상위 100개 특성만 사용
            min_df=3,  # 최소 3개 문서에서 나타나는 단어만
            max_df=0.8,  # 80% 이상 문서에서 나타나는 단어는 제외
            ngram_range=(1, 2),  # 1-gram과 2-gram 사용
            token_pattern=r'[가-힣]{2,}'  # 2글자 이상 한글만
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(category_data['processed_content'])
            
            # 클러스터 수 결정 (데이터 크기에 따라 조정)
            n_clusters = min(5, max(2, len(category_data) // 3))
            
            # K-means 클러스터링
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(tfidf_matrix)
            
            # 클러스터별 대표 키워드 추출
            feature_names = vectorizer.get_feature_names_out()
            
            for cluster_id in range(n_clusters):
                cluster_indices = np.where(cluster_labels == cluster_id)[0]
                cluster_docs = category_data.iloc[cluster_indices]
                
                print(f"\n--- 클러스터 {cluster_id + 1} ({len(cluster_indices)}개 기사) ---")
                
                # 클러스터 중심의 상위 키워드
                cluster_center = kmeans.cluster_centers_[cluster_id]
                top_indices = cluster_center.argsort()[-10:][::-1]
                top_keywords = [feature_names[i] for i in top_indices]
                
                print(f"주요 키워드: {', '.join(top_keywords)}")
                
                # 대표 기사 제목
                print("대표 기사들:")
                for i, (_, row) in enumerate(cluster_docs.head(3).iterrows()):
                    print(f"  {i+1}. {row['title']}")
            
        except Exception as e:
            print(f"클러스터링 오류: {e}")
            # 단순 키워드 빈도 분석으로 대체
            all_text = ' '.join(category_data['processed_content'])
            words = re.findall(r'[가-힣]{2,}', all_text)
            word_counts = Counter(words)
            frequent_words = {word: count for word, count in word_counts.items() if count >= 5}
            
            print(f"5회 이상 언급 키워드:")
            for word, count in sorted(frequent_words.items(), key=lambda x: x[1], reverse=True)[:15]:
                print(f"  {word}: {count}회")

# 실행
if __name__ == "__main__":
    print("=== 기본 키워드 분석 ===")
    basic_results = extract_keywords_and_cluster()
    
    print("\n\n=== 고급 클러스터링 분석 ===")
    advanced_clustering_by_keywords()

