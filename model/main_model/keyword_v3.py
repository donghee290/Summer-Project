import pandas as pd
import numpy as np
import re
import json
from collections import Counter, defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# 허깅페이스 transformers 사용을 위한 추가 import
try:
    from transformers import AutoTokenizer, AutoModel
    import torch
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("Transformers 라이브러리가 설치되지 않았습니다. 기본 분석으로 진행합니다.")

def find_csv_file():
    """CSV 파일 찾기"""
    import os
    possible_paths = [
        'clustering_results_detailed.csv',
        './kosimcse_results/clustering_results_detailed.csv',
        '../clustering_results_detailed.csv'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

def create_comprehensive_stopwords():
    """포괄적인 불용어 리스트 생성"""
    # 기본 불용어
    basic_stopwords = {
        '있다', '있는', '있을', '있어', '있었다', '있습니다', '없다', '없는', '없을',
        '되다', '된다', '되는', '될', '됐다', '됩니다', '하다', '한다', '하는', '할', '했다',
        '이다', '이며', '이고', '이라고', '라고', '라며', '으로', '로', '에서', '에게', '에', '을', '를',
        '통해', '위해', '위한', '대한', '대해', '함께', '이번', '지난', '다른', '같은', '또한', '한편',
        '이어', '이에', '그리고', '하지만', '그러나', '따라서', '그래서', '때문에', '이후', '앞서',
        '오는', '오늘', '내일', '어제', '최근', '당시', '현재', '이날', '다음', '지금',
        '것으로', '것이다', '것을', '것은', '것', '수', '등', '및', '더', '가장', '매우', '정말', '아주'
    }
    
    # 뉴스 특화 불용어
    news_stopwords = {
        '기자', '뉴스', '사진', '제공', '연합뉴스', '연합', '아시아', '조선일보', '중앙일보',
        '댓글', '답글', '추천', '추천수', '노출', '자동등록방지', '로그인', '비밀번호', '회원',
        '다른기사', '보기', '작성자', '정렬', '모음', '광고', '후원', '구독',
        '기사', '보도', '발표', '발언', '말했다', '밝혔다', '전했다', '설명했다', '강조했다',
        '예정이다', '계획이다', '전망이다', '예상된다', '관측된다'
    }
    
    # 일반적인 형용사/부사
    descriptive_stopwords = {
        '크다', '작다', '좋다', '나쁘다', '많다', '적다', '빠르다', '느리다', '높다', '낮다',
        '새로운', '오래된', '처음', '마지막', '다양한', '여러', '모든', '전체', '일부', '각각',
        '특히', '주로', '거의', '약', '대략', '정도', '만큼', '정말', '매우', '너무', '조금'
    }
    
    return basic_stopwords | news_stopwords | descriptive_stopwords

def advanced_text_preprocessing(text, stopwords):
    """고급 텍스트 전처리"""
    if pd.isna(text):
        return ""
    
    text = str(text)
    
    # 1. 기본 정리
    text = re.sub(r'[^\w\s가-힣]', ' ', text)  # 특수문자 제거
    text = re.sub(r'\d+', ' ', text)  # 숫자 제거
    text = re.sub(r'[a-zA-Z]+', ' ', text)  # 영문 제거
    text = re.sub(r'\s+', ' ', text).strip()  # 공백 정리
    
    # 2. 한글 단어 추출 및 길이 필터링
    words = re.findall(r'[가-힣]{2,}', text)
    
    # 3. 불용어 제거
    words = [word for word in words if word not in stopwords]
    
    # 4. 의미있는 단어만 선별 (빈도 기반이 아닌 길이와 패턴 기반)
    meaningful_words = []
    for word in words:
        # 너무 긴 단어 제외 (오타나 의미없는 조합일 가능성)
        if len(word) > 8:
            continue
        # 반복 패턴 제외 (예: "하하하", "아아아")
        if len(set(word)) == 1:
            continue
        meaningful_words.append(word)
    
    return ' '.join(meaningful_words)

def extract_meaningful_keywords_with_context(df, category, stopwords):
    """문맥을 고려한 키워드 추출"""
    category_data = df[df['category'] == category].copy()
    
    # 제목과 내용을 결합하되 제목에 가중치 부여
    combined_texts = []
    for _, row in category_data.iterrows():
        title = str(row['title']) if pd.notna(row['title']) else ""
        content = str(row['content']) if pd.notna(row['content']) else ""
        
        # 제목을 3번 반복하여 가중치 부여
        combined = f"{title} {title} {title} {content}"
        processed = advanced_text_preprocessing(combined, stopwords)
        combined_texts.append(processed)
    
    if not combined_texts or all(not text for text in combined_texts):
        return [], []
    
    # TF-IDF로 중요한 키워드 추출
    try:
        vectorizer = TfidfVectorizer(
            max_features=50,
            min_df=3,
            max_df=0.7,
            ngram_range=(1, 3),  # 1-3gram 사용
            token_pattern=r'[가-힣]{2,}'
        )
        
        tfidf_matrix = vectorizer.fit_transform(combined_texts)
        feature_names = vectorizer.get_feature_names_out()
        
        # 전체 문서에서의 TF-IDF 점수 합계로 키워드 중요도 계산
        tfidf_scores = np.array(tfidf_matrix.sum(axis=0)).flatten()
        keyword_importance = [(feature_names[i], float(tfidf_scores[i])) for i in range(len(feature_names))]
        keyword_importance.sort(key=lambda x: x[1], reverse=True)
        
        # 상위 키워드들과 해당 키워드가 포함된 기사들 찾기
        top_keywords = [kw for kw, score in keyword_importance[:15] if score > 0.1]
        
        # 키워드별로 관련 기사 찾기
        keyword_articles = []
        for idx, text in enumerate(combined_texts):
            if not text:
                continue
                
            matching_keywords = [kw for kw in top_keywords if kw in text]
            if matching_keywords:
                row = category_data.iloc[idx]
                keyword_articles.append({
                    'index': int(idx),
                    'title': str(row['title'])[:100] + "..." if len(str(row['title'])) > 100 else str(row['title']),
                    'content': str(row['content'])[:200] + "..." if len(str(row['content'])) > 200 else str(row['content']),
                    'matching_keywords': matching_keywords,
                    'keyword_count': len(matching_keywords)
                })
        
        # 키워드 매칭 수가 많은 순으로 정렬
        keyword_articles.sort(key=lambda x: x['keyword_count'], reverse=True)
        
        return top_keywords, keyword_articles
        
    except Exception as e:
        print(f"키워드 추출 중 오류: {e}")
        return [], []

def perform_semantic_clustering_hf(texts, category, n_clusters=None):
    """Hugging Face 모델을 사용한 의미적 클러스터링"""
    if not HF_AVAILABLE or not texts:
        return None, None, []
    
    try:
        # 한국어 BERT 모델 사용
        model_name = "klue/bert-base"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        
        # 텍스트를 벡터로 변환
        embeddings = []
        valid_texts = []
        for i, text in enumerate(texts[:50]):  # 메모리 절약을 위해 상위 50개만
            if not text.strip():
                continue
                
            inputs = tokenizer(text[:512], return_tensors="pt", truncation=True, padding=True)
            with torch.no_grad():
                outputs = model(**inputs)
                # [CLS] 토큰의 임베딩 사용
                embedding = outputs.last_hidden_state[:, 0, :].numpy().flatten()
                embeddings.append(embedding)
                valid_texts.append(i)
        
        if len(embeddings) < 3:
            return None, None, []
        
        embeddings = np.array(embeddings)
        
        # 최적 클러스터 수 결정
        if n_clusters is None:
            n_clusters = min(5, max(2, len(embeddings) // 10))
        
        # K-means 클러스터링
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings)
        
        # 실루엣 점수 계산
        try:
            silhouette_avg = silhouette_score(embeddings, cluster_labels)
        except:
            silhouette_avg = 0
        
        return kmeans, cluster_labels, valid_texts, float(silhouette_avg)
        
    except Exception as e:
        print(f"Hugging Face 모델 사용 중 오류: {e}")
        return None, None, [], 0

def perform_traditional_clustering(texts, category, stopwords):
    """전통적인 TF-IDF 기반 클러스터링 (개선된 버전)"""
    if not texts:
        return None, None, None, None
    
    processed_texts = [advanced_text_preprocessing(text, stopwords) for text in texts]
    processed_texts = [text for text in processed_texts if text.strip()]
    
    if len(processed_texts) < 3:
        return None, None, None, None
    
    try:
        vectorizer = TfidfVectorizer(
            max_features=100,
            min_df=2,
            max_df=0.8,
            ngram_range=(1, 2),
            token_pattern=r'[가-힣]{2,}'
        )
        
        tfidf_matrix = vectorizer.fit_transform(processed_texts)
        
        # 클러스터 수 결정
        n_clusters = min(5, max(2, len(processed_texts) // 8))
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(tfidf_matrix)
        
        # 실루엣 점수 계산
        try:
            silhouette_avg = silhouette_score(tfidf_matrix.toarray(), cluster_labels)
        except:
            silhouette_avg = 0
        
        return kmeans, cluster_labels, vectorizer.get_feature_names_out(), float(silhouette_avg)
        
    except Exception as e:
        print(f"전통적 클러스터링 오류: {e}")
        return None, None, None, 0

def main():
    # CSV 파일 찾기
    csv_path = find_csv_file()
    if csv_path is None:
        print("CSV 파일을 찾을 수 없습니다.")
        return
    
    print(f"파일을 찾았습니다: {csv_path}")
    df = pd.read_csv(csv_path)
    
    stopwords = create_comprehensive_stopwords()
    
    # 결과를 저장할 전체 구조
    analysis_results = {
        "metadata": {
            "analysis_date": datetime.now().isoformat(),
            "source_file": csv_path,
            "total_articles": len(df),
            "categories": list(df['category'].unique()),
            "huggingface_available": HF_AVAILABLE
        },
        "categories": {}
    }
    
    print("=== 개선된 키워드 분석 및 클러스터링 ===\n")
    
    for category in df['category'].unique():
        print(f"{'='*50}")
        print(f"카테고리: {category.upper()}")
        print(f"{'='*50}")
        
        category_data = df[df['category'] == category].copy()
        article_count = len(category_data)
        print(f"총 기사 수: {article_count}")
        
        # 카테고리별 결과 구조 초기화
        category_result = {
            "article_count": article_count,
            "keywords": {
                "top_keywords": [],
                "representative_articles": []
            },
            "clustering": {
                "method_used": "",
                "silhouette_score": 0,
                "clusters": []
            }
        }
        
        # 개선된 키워드 추출
        top_keywords, keyword_articles = extract_meaningful_keywords_with_context(df, category, stopwords)
        
        if top_keywords:
            print(f"\n주요 키워드 ({len(top_keywords)}개):")
            category_result["keywords"]["top_keywords"] = top_keywords
            
            for i, keyword in enumerate(top_keywords, 1):
                print(f"  {i:2d}. {keyword}")
            
            print(f"\n키워드 기반 대표 기사 (상위 5개):")
            for i, article in enumerate(keyword_articles[:5], 1):
                print(f"\n[{i}] {article['title']}")
                print(f"    매칭 키워드 ({article['keyword_count']}개): {', '.join(article['matching_keywords'][:5])}")
                if len(article['matching_keywords']) > 5:
                    print(f"    ... 및 {len(article['matching_keywords']) - 5}개 더")
            
            # 상위 10개 기사를 JSON에 저장
            category_result["keywords"]["representative_articles"] = keyword_articles[:10]
        
        # 의미적 클러스터링 시도
        texts = category_data['content'].fillna('').tolist()
        
        print(f"\n--- 의미적 클러스터링 결과 ---")
        
        # Hugging Face 모델 시도
        hf_result = perform_semantic_clustering_hf(texts, category)
        
        if hf_result[0] is not None:
            kmeans_hf, cluster_labels_hf, valid_indices, silhouette_score = hf_result
            print("✅ Hugging Face BERT 모델 기반 클러스터링 성공")
            
            category_result["clustering"]["method_used"] = "huggingface_bert"
            category_result["clustering"]["silhouette_score"] = silhouette_score
            
            for cluster_id in range(len(np.unique(cluster_labels_hf))):
                cluster_indices = np.where(cluster_labels_hf == cluster_id)[0]
                # valid_indices를 사용하여 원본 데이터의 인덱스 매핑
                original_indices = [valid_indices[i] for i in cluster_indices]
                cluster_docs = category_data.iloc[original_indices]
                
                print(f"\n🔍 클러스터 {cluster_id + 1} ({len(cluster_indices)}개 기사)")
                
                cluster_info = {
                    "cluster_id": cluster_id + 1,
                    "article_count": len(cluster_indices),
                    "keywords": [],
                    "representative_articles": []
                }
                
                # 클러스터 대표 기사
                print("대표 기사:")
                for i, (_, row) in enumerate(cluster_docs.head(3).iterrows()):
                    title = str(row['title'])[:80] + "..." if len(str(row['title'])) > 80 else str(row['title'])
                    print(f"  • {title}")
                    
                    cluster_info["representative_articles"].append({
                        "title": str(row['title']),
                        "content": str(row['content'])[:200] + "..." if len(str(row['content'])) > 200 else str(row['content'])
                    })
                
                category_result["clustering"]["clusters"].append(cluster_info)
        else:
            # 전통적 방법으로 대체
            print("⚠️  Hugging Face 모델 사용 불가, 전통적 방법 사용")
            trad_result = perform_traditional_clustering(texts, category, stopwords)
            
            if trad_result[0] is not None:
                kmeans, cluster_labels, feature_names, silhouette_score = trad_result
                
                category_result["clustering"]["method_used"] = "traditional_tfidf"
                category_result["clustering"]["silhouette_score"] = silhouette_score
                
                for cluster_id in range(len(np.unique(cluster_labels))):
                    cluster_indices = np.where(cluster_labels == cluster_id)[0]
                    cluster_docs = category_data.iloc[cluster_indices]
                    
                    print(f"\n🔍 클러스터 {cluster_id + 1} ({len(cluster_indices)}개 기사)")
                    
                    cluster_info = {
                        "cluster_id": cluster_id + 1,
                        "article_count": len(cluster_indices),
                        "keywords": [],
                        "representative_articles": []
                    }
                    
                    # 클러스터 키워드
                    cluster_center = kmeans.cluster_centers_[cluster_id]
                    top_indices = cluster_center.argsort()[-5:][::-1]
                    cluster_keywords = [feature_names[i] for i in top_indices if cluster_center[i] > 0.1]
                    
                    if cluster_keywords:
                        print(f"주요 키워드: {', '.join(cluster_keywords)}")
                        cluster_info["keywords"] = cluster_keywords
                    
                    # 대표 기사
                    print("대표 기사:")
                    for i, (_, row) in enumerate(cluster_docs.head(3).iterrows()):
                        title = str(row['title'])[:80] + "..." if len(str(row['title'])) > 80 else str(row['title'])
                        print(f"  • {title}")
                        
                        cluster_info["representative_articles"].append({
                            "title": str(row['title']),
                            "content": str(row['content'])[:200] + "..." if len(str(row['content'])) > 200 else str(row['content'])
                        })
                    
                    category_result["clustering"]["clusters"].append(cluster_info)
            else:
                print("❌ 클러스터링 실패")
                category_result["clustering"]["method_used"] = "failed"
        
        # 카테고리 결과를 전체 결과에 추가
        analysis_results["categories"][category] = category_result
        
        print(f"\n{'-'*50}\n")
    
    # JSON 파일로 저장
    output_filename = f"keyword_clustering_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 분석 결과가 '{output_filename}' 파일에 저장되었습니다.")
        
        # 요약 정보 출력
        print("\n=== 저장된 분석 결과 요약 ===")
        print(f"전체 기사 수: {analysis_results['metadata']['total_articles']}")
        print(f"분석 카테고리 수: {len(analysis_results['categories'])}")
        
        for category, result in analysis_results["categories"].items():
            print(f"\n[{category}]")
            print(f"  - 기사 수: {result['article_count']}")
            print(f"  - 키워드 수: {len(result['keywords']['top_keywords'])}")
            print(f"  - 클러스터링 방법: {result['clustering']['method_used']}")
            print(f"  - 클러스터 수: {len(result['clustering']['clusters'])}")
            if result['clustering']['silhouette_score'] > 0:
                print(f"  - 실루엣 점수: {result['clustering']['silhouette_score']:.3f}")
        
    except Exception as e:
        print(f"❌ JSON 파일 저장 중 오류 발생: {e}")

if __name__ == "__main__":
    main()

