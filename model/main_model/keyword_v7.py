# keyword_v9.py
import os, re, json, warnings, math
from datetime import datetime
from collections import Counter
import pandas as pd
warnings.filterwarnings('ignore')

TARGET_CATEGORIES = ['사회','경제','연예']

# ---------------- 불용어/전처리 ----------------
def create_stopwords():
    basic = {
        '있다','있는','있을','있어','있었다','있습니다','없다','없는','없을',
        '되다','된다','되는','될','됐다','됩니다','하다','한다','하는','할','했다',
        '이다','이며','이고','이라고','라고','라며','으로','로','에서','에게','에','을','를',
        '통해','위해','위한','대한','대해','함께','이번','지난','다른','같은','또한','한편',
        '이어','이에','그리고','하지만','그러나','따라서','그래서','때문에','이후','앞서',
        '오는','오늘','내일','어제','최근','당시','현재','이날','다음','지금',
        '것으로','것이다','것을','것은','것','수','등','및','더','가장','매우','정말','아주'
    }
    news = {
        '기자','뉴스','사진','제공','연합뉴스','조선일보','중앙일보','한겨레','경향신문',
        '기사','보도','발표','발언','말했다','밝혔다','전했다','설명했다','강조했다',
        '예정이다','계획이다','전망이다','예상된다','관측된다','모았다','종합'
    }
    desc = {
        '크다','작다','좋다','나쁘다','많다','적다','빠르다','느리다','높다','낮다',
        '새로운','오래된','처음','마지막','다양한','여러','모든','전체','일부','각각',
        '특히','주로','거의','약','대략','정도','만큼','조금'
    }
    # 카테고리 단어 자체는 노이즈화
    return basic | news | desc | {'사회','경제','연예'}

STOPWORDS = create_stopwords()

def to_text(x):
    if x is None: return ''
    if isinstance(x, (list, dict)): return json.dumps(x, ensure_ascii=False)
    return str(x)

def tokenize_kr(text):
    text = to_text(text)
    text = re.sub(r'[^\w\s가-힣]', ' ', text)
    text = re.sub(r'\d+', ' ', text)
    text = re.sub(r'[A-Za-z]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    words = re.findall(r'[가-힣]{2,}', text)
    toks = []
    for w in words:
        if w in STOPWORDS: continue
        if len(w) > 12: continue
        if len(set(w)) == 1: continue  # ㅋㅋㅋ 같은 반복
        toks.append(w)
    return toks

# --------------- 카테고리 분류 (content만으로) ---------------
SOC_LEX = {
    # 사건/사고/치안/사법/노동/교육/복지/재난
    '사건','사고','범죄','경찰','검찰','법원','재판','기소','구속','체포','판결','선고',
    '교통사고','화재','실종','폭행','성범죄','마약','도난','사기',
    '노조','노동','파업','근로','산재',
    '학교','교육','입시','교사','학생','대학','수능',
    '복지','의료','병원','응급','보건','감염','확진',
    '지자체','구청','시청','주민','민원','행정',
    '재난','태풍','호우','폭염','지진','산불','대설','특보'
}

ECO_LEX = {
    # 거시/금융/증시/산업/부동산/무역/기업
    '경제','경기','성장률','인플레이션','물가','지표','gdp','경상수지',
    '금리','기준금리','환율','외환','달러','원화','엔화','위안',
    '은행','대출','예금','채권','국채','회사채','금융','보험','카드',
    '증시','주가','코스피','코스닥','상장','ipo','시총','배당','실적',
    '부동산','아파트','매매','전세','월세','청약','분양','공시가격',
    '무역','수출','수입','흑자','적자','관세','원자재','유가','국제유가',
    '산업','제조업','반도체','자동차','배터리','it','수주','공장',
    '고용','취업','실업','일자리','임금','연봉',
    '기업','매출','영업이익','순이익','적자','흑자','합병','인수','리콜'
}

ENT_LEX = {
    # 연예/대중문화
    '연예','엔터','아이돌','걸그룹','보이그룹','가수','가요','앨범','싱글','컴백','티저',
    '뮤직비디오','무대','음원','차트','팬','팬클럽','콘서트','투어',
    '배우','영화','드라마','예능','방송','예고편','개봉','흥행','출연','캐스팅','시사회',
    '음악방송','ost','시상식','레드카펫','소속사','연습생'
}

# 강/중/약 신호로 구분 가능하지만 단순 합계로 충분
def score_category_by_content(text):
    tokens = tokenize_kr(text)
    s = sum(1 for t in tokens if t in SOC_LEX)
    e = sum(1 for t in tokens if t in ECO_LEX)
    n = sum(1 for t in tokens if t in ENT_LEX)

    # 강한 앵커 단어로 가중 보정
    anchors = {
        '사회': {'경찰','검찰','법원','재판','노조','파업','태풍','호우','폭염','지진','소방','구급'},
        '경제': {'금리','환율','코스피','코스닥','증시','유가','수출','수입','부동산','채권','배터리','반도체'},
        '연예': {'아이돌','컴백','소속사','시상식','레드카펫','뮤직비디오','콘서트','예능','드라마','영화'}
    }
    for t in tokens:
        if t in anchors['사회']: s += 2
        if t in anchors['경제']: e += 2
        if t in anchors['연예']: n += 2

    # 최종 라벨
    scores = {'사회': s, '경제': e, '연예': n}
    label = max(scores, key=scores.get)
    # 완전 무신호(전부 0)면 None 반환
    if all(v == 0 for v in scores.values()):
        return None
    # 동점 처리: 사회 > 경제 > 연예 우선순위로 정해도 되고, 여기선 점수 동일 시 토큰 수 많은 쪽 없으므로 고정 우선순위
    return label

# --------------- 그룹핑 ---------------
def group_by_keywords(df_cat,
                      desired_groups=5,
                      title_boost=2,
                      top_co_keywords=8,
                      min_df_floor=1):
    """
    카테고리 내 문서빈도 높은 키워드로 묶음 생성.
    - 그룹 수가 부족하면 문서빈도 임계치를 단계적으로 낮춰 최대 desired_groups까지 시도
    """
    if df_cat.empty:
        return []

    # 문서 토큰
    docs_tokens = []
    docs_sets = []
    for _, row in df_cat.iterrows():
        title = to_text(row.get('title',''))
        content = to_text(row.get('content',''))
        t_tokens = tokenize_kr(title)
        c_tokens = tokenize_kr(content)
        tokens = t_tokens * title_boost + c_tokens
        docs_tokens.append(tokens)
        docs_sets.append(set(t_tokens + c_tokens))

    # 문서빈도 계산
    df_counter = Counter()
    for s in docs_sets:
        for tok in s:
            df_counter[tok] += 1

    # 전체 빈도
    total_freq = Counter()
    for toks in docs_tokens:
        total_freq.update(toks)

    N = len(df_cat)
    # 초기 임계치: 문서 수의 2% 또는 3 중 큰 값, 상한 10
    init_min_df = min(10, max(3, math.ceil(0.02 * N)))
    # 결과가 부족하면 2 → 1로 낮춤
    for min_df in [init_min_df, 2, 1]:
        if min_df < min_df_floor: min_df = min_df_floor
        candidates = {k:v for k,v in df_counter.items() if v >= min_df}
        if not candidates:
            continue
        sorted_keywords = sorted(
            candidates.keys(),
            key=lambda k: (candidates[k], total_freq[k]),
            reverse=True
        )

        groups = []
        used = set()
        for kw in sorted_keywords:
            if len(groups) >= desired_groups: break
            if kw in used: continue
            idxs = [i for i,s in enumerate(docs_sets) if kw in s]
            if not idxs: continue

            co = Counter()
            for i in idxs: co.update(docs_sets[i])
            co_keywords = [t for t,_ in co.most_common(top_co_keywords+20)
                           if t != kw and t not in STOPWORDS][:top_co_keywords]

            items = []
            for i in idxs:
                row = df_cat.iloc[i]
                items.append({
                    "title": to_text(row.get('title',''))[:120],
                    "url": to_text(row.get('link') or row.get('url') or ''),
                    "pubDate": to_text(row.get('pubDate') or row.get('published_at') or ''),
                    "source": to_text(row.get('origin') or row.get('source') or ''),
                    "snippet": to_text(row.get('content',''))[:160]
                })

            groups.append({
                "keyword": kw,
                "doc_count": len(idxs),
                "doc_freq": candidates[kw],
                "co_keywords": co_keywords,
                "articles": items
            })
            used.add(kw)

        if groups:  # 현재 임계치로 일정 수 확보되면 종료
            return groups[:desired_groups]

    return []  # 정말 없으면 빈 리스트

# --------------- 로딩/메인 ---------------
def load_json_any(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 리스트/딕셔너리 형태 유연 처리
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if 'items' in data and isinstance(data['items'], list):
            items = data['items']
        else:
            # 첫 리스트 값
            items = None
            for k,v in data.items():
                if isinstance(v, list):
                    items = v; break
            if items is None:
                items = []
    else:
        items = []

    df = pd.DataFrame(items)
    # content 강제 생성
    #if 'content' not in df.columns:
    #    df['content'] = df.get('description','').fillna('')
    if 'content' not in df.columns:
        df['content'] = df['description'] if 'description' in df.columns else ''
        df['content'] = df['content'].fillna('')
    # 타이틀 없으면 내용 앞부분을 임시 타이틀로
    if 'title' not in df.columns:
        df['title'] = df['content'].apply(lambda x: to_text(x)[:60])

    return df

def ensure_categories(df, debug=True):
    # 원본의 category_norm이 비어있어도 재계산
    if 'category_norm' in df.columns:
        df = df.drop(columns=['category_norm'])

    df['category_norm'] = df['content'].apply(score_category_by_content)

    # 완전 미분류 문서는 버리지 말고 '사회'로 보정(요구사항: 카테고리별로 결과 생성)
    df['category_norm'] = df['category_norm'].fillna('사회')

    if debug:
        print("=== 디버그: 사용 컬럼 ===")
        print(sorted(df.columns.tolist()))
        print("\n=== 디버그: 카테고리 분포(추정) ===")
        print(df['category_norm'].value_counts().to_string())
    return df

def main():
    # 입력 파일
    json_path = 'v3_naver_news_cleaned_1hour_2025-08-05T01-50-18-041Z.json'
    if not os.path.exists(json_path):
        for f in sorted(os.listdir('.'), reverse=True):
            if f.startswith('v3_naver_news_cleaned_') and f.endswith('.json'):
                json_path = f; break
    if not os.path.exists(json_path):
        print("❌ JSON 파일을 찾을 수 없습니다."); return

    print(f"파일을 찾았습니다: {json_path}")
    df = load_json_any(json_path)
    df = ensure_categories(df, debug=True)

    results = {
        "metadata": {
            "analysis_date": datetime.now().isoformat(),
            "source_file": json_path,
            "total_articles": int(len(df)),
            "target_categories": TARGET_CATEGORIES,
            "method": "content-only-category-inference + keyword-DF-grouping(v9)"
        },
        "results": {}
    }

    for cat in TARGET_CATEGORIES:
        df_cat = df[df['category_norm'] == cat].reset_index(drop=True)
        groups = group_by_keywords(
            df_cat,
            desired_groups=5,
            title_boost=2,
            top_co_keywords=8
        )
        results["results"][cat] = {
            "article_count": int(len(df_cat)),
            "group_count": int(len(groups)),
            "groups": groups
        }

    out_name = f"grouped_news_by_keyword_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_name, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n✅ 완료! 결과 저장:", out_name)
    for cat in TARGET_CATEGORIES:
        r = results["results"][cat]
        print(f"- {cat}: 기사 {r['article_count']}건, 묶음 {r['group_count']}개")
        for i, g in enumerate(r['groups'], 1):
            print(f"  [{i}] 키워드 '{g['keyword']}' - 문서수 {g['doc_count']}")

if __name__ == "__main__":
    main()
