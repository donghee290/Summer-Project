# kosimcse_direct_embedder.py
from sentence_transformers import SentenceTransformer
import json
import numpy as np
from tqdm import tqdm

def embed_with_original_kosimcse():
    print("🚀 Python으로 원본 KoSimCSE 사용")
    
    # 원본 KoSimCSE 모델 직접 로드
    try:
        model = SentenceTransformer('BM-K/KoSimCSE-roberta-multitask')
        print("✅ 원본 KoSimCSE 모델 로드 성공!")
        print(f"   차원: {model.get_sentence_embedding_dimension()}")
    except Exception as e:
        print(f"❌ 모델 로드 실패: {e}")
        return
    
    # 뉴스 데이터 로드
    print("\n📊 뉴스 데이터 로딩...")
    with open('source/v3_naver_news_cleaned_1hour_2025-07-29T02-19-57-117Z.json', 'r', encoding='utf-8') as f:
        news_data = json.load(f)
    
    # 기사 전처리
    articles = []
    category_stats = {}
    
    for category, article_list in news_data['news'].items():
        if not isinstance(article_list, list):
            continue
            
        for article in article_list:
            title = article.get('title', '')
            content = article.get('content', '')
            full_text = f"{title}. {content}".strip()
            
            if len(full_text) > 100 and len(title) > 10:
                articles.append({
                    **article,
                    'fullText': full_text,
                    'textLength': len(full_text),
                    'category': category,
                    'index': len(articles)
                })
                category_stats[category] = category_stats.get(category, 0) + 1
    
    print(f"✅ 전처리 완료: {len(articles)}개 기사")
    print("카테고리별 분포:")
    for cat, count in category_stats.items():
        print(f"   {cat}: {count}개")
    
    # KoSimCSE 임베딩 생성 (배치 처리)
    print(f"\n⚡ KoSimCSE 임베딩 생성 중...")
    texts = [article['fullText'] for article in articles]
    
    # 배치 크기 조정 (메모리 최적화)
    batch_size = 32
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True  # SimCSE 표준
    )
    
    print(f"✅ 임베딩 완료! 형태: {embeddings.shape}")
    
    # 결과 저장 (JavaScript 호환 형식)
    result = {
        'articles': articles,
        'embeddings': embeddings.tolist(),
        'metadata': {
            'model': 'BM-K/KoSimCSE-roberta-multitask',
            'embedding_method': 'SimCSE',
            'dimensions': int(embeddings.shape[1]),
            'totalArticles': len(articles),
            'createdAt': '2025-08-01T15:00:00.000Z',
            'categories': category_stats,
            'preprocessing': 'kosimcse_python',
            'version': '4.0'
        }
    }
    
    # JSON 저장
    with open('kosimcse_python_embeddings.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("✅ kosimcse_python_embeddings.json 저장")
    
    # CSV 저장 (클러스터링용)
    import pandas as pd
    
    csv_data = []
    for i, article in enumerate(articles):
        csv_data.append({
            'index': i,
            'title': article['title'].replace('"', '""'),
            'category': article['category'],
            'textLength': article['textLength'],
            'embedding': ','.join(map(str, embeddings[i])),
            'pubDate': article.get('pubDate', ''),
            'url': article.get('originalUrl', '')
        })
    
    df = pd.DataFrame(csv_data)
    df.to_csv('kosimcse_python_embeddings.csv', index=False, encoding='utf-8')
    print("✅ kosimcse_python_embeddings.csv 저장")
    
    # 유사도 테스트
    print(f"\n🧪 KoSimCSE 유사도 테스트")
    test_queries = ['경제', '사회', '연예']
    
    for query in test_queries:
        query_embedding = model.encode([query], normalize_embeddings=True)[0]
        similarities = np.dot(embeddings, query_embedding)
        
        top_indices = np.argsort(similarities)[-3:][::-1]
        print(f"\n'{query}' 유사 기사:")
        for i, idx in enumerate(top_indices):
            print(f"  {i+1}. [{similarities[idx]:.4f}] {articles[idx]['title'][:50]}...")
    
    print(f"\n🎯 완료! 다음 단계: python improved_clustering.py")
    return result

if __name__ == "__main__":
    embed_with_original_kosimcse()

