import pandas as pd
import numpy as np
import re
import json
from collections import Counter, defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

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
    
    # 4. 의미있는 단어만 선별
    meaningful_words = []
    for word in words:
        # 너무 긴 단어 제외
        if len(word) > 8:
            continue
        # 반복 패턴 제외
        if len(set(word)) == 1:
            continue
        meaningful_words.append(word)
    
    return meaningful_words

def extract_category_keywords(df, category, stopwords, min_frequency=3):
    """카테고리별 전체 키워드 추출"""
    category_data = df[df['category'] == category].copy()
    
    # 모든 기사의 텍스트 수집
    all_words = []
    for _, row in category_data.iterrows():
        title = str(row['title']) if pd.notna(row['title']) else ""
        content = str(row['content']) if pd.notna(row['content']) else ""
        
        # 제목에 가중치 부여 (3배)
        title_words = advanced_text_preprocessing(title, stopwords)
        content_words = advanced_text_preprocessing(content, stopwords)
        
        all_words.extend(title_words * 3)  # 제목 가중치
        all_words.extend(content_words)
    
    # 단어 빈도 계산
    word_freq = Counter(all_words)
    
    # 최소 빈도 이상의 키워드만 반환
    valid_keywords = {word: freq for word, freq in word_freq.items() if freq >= min_frequency}
    
    return valid_keywords

def calculate_article_keyword_score(article_text, title_text, category_keywords, stopwords):
    """개별 기사의 키워드 점수 계산"""
    # 기사 텍스트 전처리
    article_words = advanced_text_preprocessing(article_text, stopwords)
    title_words = advanced_text_preprocessing(title_text, stopwords)
    
    # 제목과 내용에서 카테고리 키워드 매칭
    title_matches = []
    content_matches = []
    
    for word in title_words:
        if word in category_keywords:
            title_matches.append(word)
    
    for word in article_words:
        if word in category_keywords:
            content_matches.append(word)
    
    # 점수 계산 (제목 매칭에 더 높은 가중치)
    title_score = len(title_matches) * 3
    content_score = len(content_matches)
    total_score = title_score + content_score
    
    # 유니크 키워드 수
    unique_keywords = list(set(title_matches + content_matches))
    
    return {
        'total_score': total_score,
        'unique_keyword_count': len(unique_keywords),
        'title_keywords': title_matches,
        'content_keywords': content_matches,
        'all_keywords': unique_keywords
    }

def get_top_keyword_articles_by_category(df, category, stopwords, top_n=3):
    """카테고리별 상위 키워드 기사 추출"""
    print(f"\n{'='*50}")
    print(f"카테고리: {category.upper()}")
    print(f"{'='*50}")
    
    category_data = df[df['category'] == category].copy()
    print(f"총 기사 수: {len(category_data)}")
    
    # 카테고리 전체 키워드 추출
    category_keywords = extract_category_keywords(df, category, stopwords)
    print(f"유효 키워드 수: {len(category_keywords)}")
    
    if not category_keywords:
        print("유효한 키워드를 찾을 수 없습니다.")
        return []
    
    # 각 기사의 키워드 점수 계산
    article_scores = []
    
    for idx, row in category_data.iterrows():
        title = str(row['title']) if pd.notna(row['title']) else ""
        content = str(row['content']) if pd.notna(row['content']) else ""
        
        score_info = calculate_article_keyword_score(content, title, category_keywords, stopwords)
        
        # 최소 키워드 수 조건 (너무 적은 키워드 제외)
        if score_info['unique_keyword_count'] >= 5:
            article_scores.append({
                'index': idx,
                'title': title,
                'content': content,
                'score_info': score_info
            })
    
    # 점수순으로 정렬 (총점 우선, 유니크 키워드 수 차순)
    article_scores.sort(key=lambda x: (x['score_info']['total_score'], 
                                     x['score_info']['unique_keyword_count']), 
                       reverse=True)
    
    # 상위 기사들 출력 및 반환
    top_articles = []
    
    print(f"\n상위 {top_n}개 키워드 기사:")
    for i, article in enumerate(article_scores[:top_n]):
        score_info = article['score_info']
        
        print(f"\n[{i+1}] {article['title'][:100]}{'...' if len(article['title']) > 100 else ''}")
        print(f"    총 키워드 점수: {score_info['total_score']}")
        print(f"    유니크 키워드 수: {score_info['unique_keyword_count']}")
        print(f"    제목 키워드 ({len(score_info['title_keywords'])}개): {', '.join(score_info['title_keywords'][:10])}")
        if len(score_info['title_keywords']) > 10:
            print(f"    ... 및 {len(score_info['title_keywords']) - 10}개 더")
        print(f"    내용 키워드 ({len(score_info['content_keywords'])}개): {', '.join(list(set(score_info['content_keywords']))[:15])}")
        if len(set(score_info['content_keywords'])) > 15:
            print(f"    ... 및 {len(set(score_info['content_keywords'])) - 15}개 더")
        
        # JSON 저장용 데이터 구성
        top_articles.append({
            'rank': i + 1,
            'title': article['title'],
            'content': article['content'][:500] + "..." if len(article['content']) > 500 else article['content'],
            'keyword_analysis': {
                'total_score': score_info['total_score'],
                'unique_keyword_count': score_info['unique_keyword_count'],
                'title_keywords': score_info['title_keywords'],
                'content_keywords': list(set(score_info['content_keywords'])),  # 중복 제거
                'all_unique_keywords': score_info['all_keywords']
            }
        })
    
    return top_articles

def main():
    # CSV 파일 찾기
    csv_path = find_csv_file()
    if csv_path is None:
        print("CSV 파일을 찾을 수 없습니다.")
        return
    
    print(f"파일을 찾았습니다: {csv_path}")
    df = pd.read_csv(csv_path)
    
    stopwords = create_comprehensive_stopwords()
    
    # 분석할 카테고리 정의
    target_categories = ['society', 'economy', 'entertainment']
    
    # 결과 저장용 구조
    analysis_results = {
        "metadata": {
            "analysis_date": datetime.now().isoformat(),
            "source_file": csv_path,
            "total_articles": len(df),
            "analyzed_categories": target_categories,
            "analysis_type": "top_keyword_articles_by_category"
        },
        "results": {}
    }
    
    print("=== 카테고리별 최다 키워드 기사 분석 ===")
    
    # 각 카테고리별로 분석
    for category in target_categories:
        if category in df['category'].values:
            top_articles = get_top_keyword_articles_by_category(df, category, stopwords, top_n=3)
            analysis_results["results"][category] = {
                "article_count": len(df[df['category'] == category]),
                "top_keyword_articles": top_articles
            }
        else:
            print(f"\n경고: '{category}' 카테고리를 데이터에서 찾을 수 없습니다.")
            analysis_results["results"][category] = {
                "article_count": 0,
                "top_keyword_articles": [],
                "error": "카테고리를 찾을 수 없음"
            }
    
    # JSON 파일로 저장
    output_filename = f"top_keyword_articles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ 분석 결과가 '{output_filename}' 파일에 저장되었습니다.")
        
        # 요약 정보 출력
        print("\n=== 저장된 분석 결과 요약 ===")
        print(f"전체 기사 수: {analysis_results['metadata']['total_articles']}")
        print(f"분석 카테고리: {', '.join(target_categories)}")
        
        for category in target_categories:
            if category in analysis_results["results"]:
                result = analysis_results["results"][category]
                if "error" not in result:
                    print(f"\n[{category}]")
                    print(f"  - 전체 기사 수: {result['article_count']}")
                    print(f"  - 선정된 상위 기사 수: {len(result['top_keyword_articles'])}")
                    
                    # 각 기사의 키워드 수 정보
                    for i, article in enumerate(result['top_keyword_articles'], 1):
                        kw_analysis = article['keyword_analysis']
                        print(f"  - {i}위 기사: {kw_analysis['unique_keyword_count']}개 키워드 (점수: {kw_analysis['total_score']})")
                else:
                    print(f"\n[{category}] - 오류: {result['error']}")
        
        print(f"\n상세 분석 결과는 '{output_filename}' 파일을 확인하세요.")
        
    except Exception as e:
        print(f"❌ JSON 파일 저장 중 오류 발생: {e}")

if __name__ == "__main__":
    main()

