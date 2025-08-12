import pandas as pd
import numpy as np
import re
import json
import os
from collections import Counter, defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class CSVArticleAnalyzer:
    def __init__(self):
        self.stopwords = self.create_comprehensive_stopwords()
        self.articles_df = None
        
    def create_comprehensive_stopwords(self):
        """포괄적인 불용어 리스트 생성"""
        basic_stopwords = {
            '있다', '있는', '있을', '있어', '있었다', '있습니다', '없다', '없는', '없을',
            '되다', '된다', '되는', '될', '됐다', '됩니다', '하다', '한다', '하는', '할', '했다',
            '이다', '이며', '이고', '이라고', '라고', '라며', '으로', '로', '에서', '에게', '에', '을', '를',
            '통해', '위해', '위한', '대한', '대해', '함께', '이번', '지난', '다른', '같은', '또한', '한편',
            '이어', '이에', '그리고', '하지만', '그러나', '따라서', '그래서', '때문에', '이후', '앞서',
            '오는', '오늘', '내일', '어제', '최근', '당시', '현재', '이날', '다음', '지금', '같이',
            '것으로', '것이다', '것을', '것은', '것', '수', '등', '및', '더', '가장', '매우', '정말', '아주',
            '만큼', '정도', '약간', '조금', '많이', '잘', '잘못', '빨리', '천천히'
        }
        
        news_stopwords = {
            '기자', '뉴스', '사진', '제공', '연합뉴스', '연합', '아시아', '조선일보', '중앙일보',
            '댓글', '답글', '추천', '추천수', '노출', '자동등록방지', '로그인', '비밀번호', '회원',
            '다른기사', '보기', '작성자', '정렬', '모음', '광고', '후원', '구독',
            '기사', '보도', '발표', '발언', '말했다', '밝혔다', '전했다', '설명했다', '강조했다',
            '예정이다', '계획이다', '전망이다', '예상된다', '관측된다', '알려졌다', '나타났다'
        }
        
        descriptive_stopwords = {
            '크다', '작다', '좋다', '나쁘다', '많다', '적다', '빠르다', '느리다', '높다', '낮다',
            '새로운', '오래된', '처음', '마지막', '다양한', '여러', '모든', '전체', '일부', '각각',
            '특히', '주로', '거의', '약', '대략', '정도', '만큼', '정말', '매우', '너무', '조금',
            '그런', '이런', '저런', '어떤', '어느', '무엇', '누구', '언제', '어디', '어떻게', '왜'
        }
        
        return basic_stopwords | news_stopwords | descriptive_stopwords

    def find_csv_file(self):
        """CSV 파일 찾기"""
        possible_paths = [
            'clustering_results_detailed.csv',
            './kosimcse_results/clustering_results_detailed.csv',
            '../clustering_results_detailed.csv'
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # 현재 디렉토리에서 CSV 파일 찾기
        csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]
        if csv_files:
            print(f"발견된 CSV 파일들: {csv_files}")
            return csv_files[0]  # 첫 번째 CSV 파일 사용
        
        return None

    def load_csv_data(self, csv_path=None):
        """CSV 파일 로드"""
        if csv_path is None:
            csv_path = self.find_csv_file()
        
        if csv_path is None:
            print("CSV 파일을 찾을 수 없습니다.")
            return False
        
        try:
            print(f"CSV 파일을 로드합니다: {csv_path}")
            self.articles_df = pd.read_csv(csv_path)
            
            # 필요한 컬럼 확인
            required_columns = ['content']
            if 'title' not in self.articles_df.columns:
                self.articles_df['title'] = ''  # title이 없으면 빈 문자열로 설정
            if 'category' not in self.articles_df.columns:
                self.articles_df['category'] = 'UNKNOWN'  # category가 없으면 UNKNOWN으로 설정
            
            print(f"로드 완료: {len(self.articles_df)}개 기사")
            print(f"컬럼: {list(self.articles_df.columns)}")
            
            # content가 비어있는 행 제거
            self.articles_df = self.articles_df.dropna(subset=['content'])
            self.articles_df = self.articles_df[self.articles_df['content'].str.strip() != '']
            
            print(f"유효한 기사: {len(self.articles_df)}개")
            return True
            
        except Exception as e:
            print(f"CSV 파일 로드 오류: {e}")
            return False

    def extract_keywords_from_text(self, text, min_length=2, max_length=8):
        """텍스트에서 키워드 추출"""
        if pd.isna(text) or not text:
            return []
        
        text = str(text)
        
        # 전처리
        text = re.sub(r'[^\w\s가-힣]', ' ', text)  # 특수문자 제거
        text = re.sub(r'\d+', ' ', text)  # 숫자 제거
        text = re.sub(r'[a-zA-Z]+', ' ', text)  # 영문 제거
        text = re.sub(r'\s+', ' ', text).strip()  # 공백 정리
        
        # 한글 단어 추출
        words = re.findall(r'[가-힣]{2,}', text)
        
        # 필터링
        keywords = []
        for word in words:
            if (min_length <= len(word) <= max_length and 
                word not in self.stopwords and
                len(set(word)) > 1):  # 반복 패턴 제거 (예: "하하하")
                keywords.append(word)
        
        return keywords

    def calculate_article_keyword_density(self, row):
        """기사의 키워드 밀도 계산"""
        title = str(row.get('title', '')) if pd.notna(row.get('title', '')) else ''
        content = str(row['content']) if pd.notna(row['content']) else ''
        
        title_keywords = self.extract_keywords_from_text(title)
        content_keywords = self.extract_keywords_from_text(content)
        
        # 제목 키워드에 가중치 부여 (3배)
        all_keywords = title_keywords * 3 + content_keywords
        unique_keywords = list(set(all_keywords))
        
        # 키워드 빈도
        keyword_freq = Counter(all_keywords)
        
        return {
            'total_keyword_count': len(all_keywords),
            'unique_keyword_count': len(unique_keywords),
            'title_keywords': title_keywords,
            'content_keywords': content_keywords,
            'unique_keywords': unique_keywords,
            'keyword_frequency': dict(keyword_freq),
            'density_score': len(all_keywords) + len(unique_keywords) * 2  # 총점 계산
        }

    def find_top_keyword_articles(self, top_n=3):
        """가장 많은 키워드를 가진 기사들 찾기"""
        print("\n=== 키워드 밀도 분석 중... ===")
        
        article_scores = []
        
        for idx, row in self.articles_df.iterrows():
            keyword_info = self.calculate_article_keyword_density(row)
            
            # 최소 키워드 수 조건 (너무 적은 키워드는 제외)
            if keyword_info['unique_keyword_count'] >= 5:
                article_scores.append({
                    'index': idx,
                    'row_data': row,
                    'keyword_info': keyword_info
                })
        
        # 키워드 밀도 점수로 정렬
        article_scores.sort(key=lambda x: x['keyword_info']['density_score'], reverse=True)
        
        print(f"키워드 분석 완료: {len(article_scores)}개 기사 중 상위 {top_n}개 선별")
        
        # 결과 출력
        print(f"\n상위 {top_n}개 키워드 밀도 기사:")
        for i, article_data in enumerate(article_scores[:top_n]):
            row = article_data['row_data']
            keyword_info = article_data['keyword_info']
            
            title = str(row.get('title', '기사 제목 없음'))[:80]
            category = str(row.get('category', 'UNKNOWN'))
            
            print(f"\n[{i+1}위] {title}{'...' if len(str(row.get('title', ''))) > 80 else ''}")
            print(f"   카테고리: {category}")
            print(f"   키워드 점수: {keyword_info['density_score']}")
            print(f"   유니크 키워드 수: {keyword_info['unique_keyword_count']}")
            print(f"   주요 키워드: {', '.join(keyword_info['unique_keywords'][:15])}")
        
        return article_scores[:top_n]

    def group_articles_by_topic_similarity(self, top_articles, similarity_threshold=0.3):
        """기사들을 주제 유사성으로 그룹핑"""
        print(f"\n=== 주제별 그룹핑 분석 중... (유사도 임계값: {similarity_threshold}) ===")
        
        if len(top_articles) < 2:
            return [{'topic': '단일_기사', 'articles': top_articles, 'similarity_score': 1.0}]
        
        # 텍스트 벡터화를 위한 데이터 준비
        texts = []
        for article_data in top_articles:
            row = article_data['row_data']
            keyword_info = article_data['keyword_info']
            
            title = str(row.get('title', ''))
            content = str(row['content'])[:1000]  # 처음 1000자만 사용
            
            # 키워드 기반 텍스트 구성 (키워드에 더 많은 가중치)
            keywords = keyword_info['unique_keywords']
            keyword_text = ' '.join(keywords * 2)  # 키워드 2배 반복
            
            combined_text = f"{title} {title} {keyword_text} {content}"
            processed_text = ' '.join(self.extract_keywords_from_text(combined_text))
            texts.append(processed_text)
        
        try:
            # TF-IDF 벡터화
            vectorizer = TfidfVectorizer(
                max_features=200,
                min_df=1,
                max_df=0.9,
                ngram_range=(1, 2),
                token_pattern=r'[가-힣]{2,}'
            )
            
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            if tfidf_matrix.shape[0] == 0:
                print("벡터화 실패: 카테고리별 그룹핑으로 대체")
                return self.group_by_category(top_articles)
            
            # 코사인 유사도 계산
            similarity_matrix = cosine_similarity(tfidf_matrix)
            
            # 클러스터링 (유사도 기반)
            groups = self.cluster_by_similarity(similarity_matrix, top_articles, similarity_threshold)
            
            return groups
            
        except Exception as e:
            print(f"주제 그룹핑 오류: {e}")
            # 폴백: 카테고리별 그룹핑
            return self.group_by_category(top_articles)

    def cluster_by_similarity(self, similarity_matrix, articles, threshold):
        """유사도 매트릭스를 기반으로 클러스터링"""
        n_articles = len(articles)
        groups = []
        used_indices = set()
        
        for i in range(n_articles):
            if i in used_indices:
                continue
            
            # 현재 기사와 유사한 기사들 찾기
            similar_indices = [i]
            used_indices.add(i)
            
            for j in range(i + 1, n_articles):
                if j not in used_indices and similarity_matrix[i][j] > threshold:
                    similar_indices.append(j)
                    used_indices.add(j)
            
            # 그룹 생성
            group_articles = [articles[idx] for idx in similar_indices]
            
            # 주제명 생성 (가장 빈번한 키워드들로)
            all_keywords = []
            for article_data in group_articles:
                all_keywords.extend(article_data['keyword_info']['unique_keywords'])
            
            keyword_freq = Counter(all_keywords)
            top_keywords = [kw for kw, freq in keyword_freq.most_common(3)]
            
            # 카테고리 정보도 포함
            categories = [article_data['row_data'].get('category', 'UNKNOWN') for article_data in group_articles]
            main_category = Counter(categories).most_common(1)[0][0]
            
            topic_name = f"{main_category}_{('_'.join(top_keywords) if top_keywords else f'그룹_{len(groups)+1}')}"
            
            # 유사도 점수 계산
            if len(similar_indices) > 1:
                similarity_scores = []
                for ii in similar_indices:
                    for jj in similar_indices:
                        if ii != jj:
                            similarity_scores.append(similarity_matrix[ii][jj])
                avg_similarity = float(np.mean(similarity_scores)) if similarity_scores else 0.0
            else:
                avg_similarity = 1.0
            
            groups.append({
                'topic': topic_name,
                'articles': group_articles,
                'similarity_score': avg_similarity,
                'main_category': main_category
            })
        
        return groups

    def group_by_category(self, articles):
        """카테고리별 그룹핑 (폴백 방법)"""
        print("카테고리별 그룹핑을 사용합니다.")
        
        category_groups = defaultdict(list)
        
        for article_data in articles:
            category = article_data['row_data'].get('category', 'UNKNOWN')
            category_groups[category].append(article_data)
        
        groups = []
        for category, group_articles in category_groups.items():
            # 주요 키워드 추출
            all_keywords = []
            for article_data in group_articles:
                all_keywords.extend(article_data['keyword_info']['unique_keywords'])
            
            keyword_freq = Counter(all_keywords)
            top_keywords = [kw for kw, freq in keyword_freq.most_common(3)]
            
            topic_name = f"{category}_{('_'.join(top_keywords) if top_keywords else '기본그룹')}"
            
            groups.append({
                'topic': topic_name,
                'articles': group_articles,
                'similarity_score': 1.0,
                'main_category': category
            })
        
        return groups

    def analyze_and_save_results(self, csv_path=None, output_filename=None, top_n=3):
        """전체 분석 프로세스 실행 및 결과 저장"""
        
        # 1. CSV 파일 로드
        if not self.load_csv_data(csv_path):
            return None
        
        # 2. 키워드 밀도가 높은 기사들 찾기
        top_articles = self.find_top_keyword_articles(top_n)
        
        if not top_articles:
            print("분석할 기사를 찾을 수 없습니다.")
            return None
        
        # 3. 주제별 그룹핑
        grouped_articles = self.group_articles_by_topic_similarity(top_articles)
        
        # 4. 결과 정리
        results = {
            'metadata': {
                'analysis_date': datetime.now().isoformat(),
                'source_file': csv_path or 'auto-detected',
                'total_articles_loaded': len(self.articles_df),
                'top_articles_selected': len(top_articles),
                'topic_groups_created': len(grouped_articles)
            },
            'top_articles': [],
            'topic_groups': []
        }
        
        # 상위 기사 정보 저장
        for i, article_data in enumerate(top_articles):
            row = article_data['row_data']
            keyword_info = article_data['keyword_info']
            
            results['top_articles'].append({
                'rank': i + 1,
                'title': str(row.get('title', '제목 없음')),
                'content': str(row['content'])[:500] + "..." if len(str(row['content'])) > 500 else str(row['content']),
                'category': str(row.get('category', 'UNKNOWN')),
                'keyword_analysis': {
                    'total_keyword_count': keyword_info['total_keyword_count'],
                    'unique_keyword_count': keyword_info['unique_keyword_count'],
                    'density_score': keyword_info['density_score'],
                    'top_keywords': keyword_info['unique_keywords'][:20]
                }
            })
        
        # 주제 그룹 정보 저장
        for i, group in enumerate(grouped_articles):
            group_info = {
                'group_id': i + 1,
                'topic_name': group['topic'],
                'main_category': group.get('main_category', 'UNKNOWN'),
                'article_count': len(group['articles']),
                'similarity_score': group.get('similarity_score', 0),
                'articles': []
            }
            
            for article_data in group['articles']:
                row = article_data['row_data']
                keyword_info = article_data['keyword_info']
                
                group_info['articles'].append({
                    'title': str(row.get('title', '제목 없음')),
                    'content': str(row['content'])[:300] + "..." if len(str(row['content'])) > 300 else str(row['content']),
                    'category': str(row.get('category', 'UNKNOWN')),
                    'top_keywords': keyword_info['unique_keywords'][:10],
                    'keyword_score': keyword_info['density_score']
                })
            
            results['topic_groups'].append(group_info)
        
        # 5. 결과 저장
        if not output_filename:
            output_filename = f"csv_article_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        # 6. 결과 출력
        self.print_analysis_results(results, output_filename)
        
        return results

    def print_analysis_results(self, results, filename):
        """분석 결과 출력"""
        print(f"\n{'='*60}")
        print("분석 결과 요약")
        print(f"{'='*60}")
        
        metadata = results['metadata']
        print(f"전체 로드된 기사: {metadata['total_articles_loaded']}개")
        print(f"선별된 상위 기사: {metadata['top_articles_selected']}개")
        print(f"생성된 주제 그룹: {metadata['topic_groups_created']}개")
        
        print(f"\n{'='*40}")
        print("주제별 그룹핑 결과")
        print(f"{'='*40}")
        
        for group in results['topic_groups']:
            print(f"\n[그룹 {group['group_id']}] {group['topic_name']}")
            print(f"   주요 카테고리: {group['main_category']}")
            print(f"   기사 수: {group['article_count']}개")
            print(f"   유사도 점수: {group['similarity_score']:.3f}")
            
            for i, article in enumerate(group['articles'], 1):
                print(f"   {i}. {article['title'][:60]}...")
                print(f"      키워드: {', '.join(article['top_keywords'][:8])}")
                print(f"      점수: {article['keyword_score']}")
        
        print(f"\n✅ 상세 결과가 '{filename}' 파일에 저장되었습니다.")

# 실행 함수
def main():
    analyzer = CSVArticleAnalyzer()
    
    # CSV 파일 경로 입력 (없으면 자동 탐지)
    csv_path = input("CSV 파일 경로를 입력하세요 (엔터: 자동 탐지): ").strip()
    if not csv_path:
        csv_path = None
    
    # 분석 실행
    try:
        results = analyzer.analyze_and_save_results(
            csv_path=csv_path,
            top_n=3  # 상위 3개 기사 선별
        )
        
        if results:
            print("\n분석이 완료되었습니다!")
        
    except Exception as e:
        print(f"분석 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

