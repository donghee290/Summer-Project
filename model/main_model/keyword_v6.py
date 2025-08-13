import json
import re
import numpy as np
import pandas as pd
from collections import defaultdict
from sklearn.feature_extraction.text import CountVectorizer

# === 1. JSON 뉴스 파일 불러오기 ===
with open("v3_naver_news_cleaned_1hour_2025-08-05T01-50-18-041Z.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# === 2. 카테고리별 뉴스 기사 가져오기 ===
category_articles = {
    cat: [item["content"] for item in data["news"][cat] if item.get("content")]
    for cat in ['economy', 'society', 'entertainment']
}

# === 3. 불용어 리스트 (조사 제거용) ===
stopwords = [
    '이', '그', '저', '것', '수', '등', '들', '및', '더', '만', '전', '중', '로',
    '가', '를', '에', '의', '와', '과', '해서', '하고', '으로', '부터', '이다',
    '기자', '사진', '관련', '있다', '이번'
]

# === 4. 기사 텍스트 전처리 함수 ===
def clean_korean_text(text):
    return " ".join(re.findall(r'\b[가-힣]{2,}\b', text))

# === 5. 분석 및 키워드 기반 기사 묶기 ===
final_result = []

for category, articles in category_articles.items():
    cleaned_articles = [clean_korean_text(article) for article in articles]

    vectorizer = CountVectorizer(max_features=1000, stop_words=stopwords)
    X = vectorizer.fit_transform(cleaned_articles)

    keywords = vectorizer.get_feature_names_out()
    word_freq = np.asarray(X.sum(axis=0)).flatten()
    top_indices = word_freq.argsort()[-5:][::-1]
    top_keywords = [keywords[i] for i in top_indices]

    grouped = defaultdict(list)
    for idx, article in enumerate(cleaned_articles):
        for kw in top_keywords:
            if kw in article:
                grouped[kw].append(article)
                break

    for kw in top_keywords:
        articles_for_kw = grouped[kw]
        final_result.append({
            "category": category,
            "keyword": kw,
            "count": len(articles_for_kw),
            "sample": articles_for_kw[0][:100] + "..." if articles_for_kw else ""
        })

# === 6. 결과 저장 ===

# 6-1. JSON 저장
with open("뉴스_키워드_분류_결과.json", "w", encoding="utf-8") as f:
    json.dump(final_result, f, ensure_ascii=False, indent=2)

# 6-2. 텍스트 파일 저장
with open("뉴스_키워드_분류_결과.txt", "w", encoding="utf-8") as f:
    for item in final_result:
        f.write(f"[카테고리] {item['category']}\n")
        f.write(f"[키워드] {item['keyword']}\n")
        f.write(f"[기사 수] {item['count']}\n")
        f.write(f"[대표 문장] {item['sample']}\n")
        f.write("-" * 50 + "\n")

# 6-3. (선택) DataFrame도 출력하고 싶다면
df = pd.DataFrame(final_result)
print(df)
