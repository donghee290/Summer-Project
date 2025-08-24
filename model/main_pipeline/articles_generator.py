import os, json, time, random, re, base64, hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Tuple
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv

import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import OpenAI

HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[2]
IN_BASE  = PROJECT_ROOT / "model" / "results" / "cluster_results"
OUT_BASE = PROJECT_ROOT / "model" / "results" / "generate_results"
OUT_BASE.mkdir(parents=True, exist_ok=True)

def _latest_cluster_csv() -> str:
    files = sorted(
        IN_BASE.glob("clustering_results_detailed_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    return str(files[0]) if files else str(IN_BASE / "clustering_results_detailed.csv")

INPUT_CSV = _latest_cluster_csv()

IMG_DIR = OUT_BASE / "images"
IMG_DIR.mkdir(parents=True, exist_ok=True)

PUBLIC_MEDIA_ROUTE = "/media"

load_dotenv(find_dotenv(), override=True)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다. .env 또는 환경변수를 확인하세요.")
client = OpenAI(api_key=OPENAI_API_KEY)

TITLE_MAX_CHARS   = 60
SUMMARY_MAX_CHARS = 300
REWRITE_MAX_CHARS = 1300

ENABLE_IMAGE_GEN = True
IMAGE_MODEL  = "dall-e-3"
IMAGE_SIZE   = "1792x1024"
IMAGE_FORMAT = "png"

MAX_ARTICLES_PER_CLUSTER = 5
MIN_BODY_CHARS = 200
SLEEP_BETWEEN_CALLS = 0.4

CATS = {"국내경제","해외경제","사회","트렌드"}

RAW2KO_BASE = {
    "society": "사회",
    "entertainment": "트렌드",
}
GLOBAL_HINTS = [
    "미국","중국","일본","유럽","EU","글로벌","세계","월가","연준","Fed","ECB","BOJ",
    "해외","국제","달러","엔","유로","위안","수입","수출","환율"
]

SYSTEM_PROMPT = (
    "당신은 한국어 뉴스 다문서 요약 어시스턴트입니다. "
    "20~30대도 빠르게 이해하도록 쉬운 문장, 핵심 위주, 과장/추측 금지. "
    "날짜·수치·기관명 등 사실 정보는 보존하고, 상충 시 출처에 근거해 신중하게 기술합니다. "
    "출력은 반드시 JSON 하나만 반환하세요. "
    "스타일 규칙: 재가공 본문은 반드시 경어체(합니다/입니다)로만 작성. "
    "재가공 본문에서 평서형 '-다/했다/이다/한다' 금지."
)

USER_PROMPT_TMPL = """다음은 같은 군집의 여러 기사입니다. 이들을 하나의 아티클로 통합하세요.

[기사 목록(요약 메타)]
{items_meta}

[기사 원문 스니펫(최대 3500자)]
{items_bodies}

요구사항:
1) 제목: 핵심을 압축, {title_max}자 이내
2) 요약문: 정확히 3개 ‘개조식’ 조항으로 작성, 전체 {summary_max}자 이내
   - 개조식/명사형(체언절) 말투로 통일(예: “~ 발표”, “~ 확대”, “~ 하락”)
   - 서술형 어미(“~다/~요/~습니다” 등) 금지, 감탄/의문 금지
   - 각 조항 끝에 마침표/느낌표/물음표 사용 금지
   - 세 조항은 한 줄 문자열로, ‘ · ’(앞뒤 공백 포함)로 구분하여 반환
3) 재가공 본문: 배경→핵심 사실→의미/쟁점 순 기사체, {rewrite_max}자 이내,
   - **경어체(합니다/입니다)만 사용**, 평서형 '-다/했다/이다/한다' 일절 금지
   - 군더더기 수식 최소화, 문장 호흡 짧게(가독성 우선)
4) 중복/광고/댓글 흔적 제거, 불확실 정보 단정 금지
5) 20~30대도 이해하기 쉽게, 전문용어는 짧게 풀어 설명
6) 서로 유사한 내용의 기사만을 하나의 아티클로 다룰 것

반환 JSON 스키마:
{{
  "title": "...",
  "summary": "...",
  "rewritten_body": "..."
}}
"""

def now_kst_iso() -> str:
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d %H:%M:%S")

def prefer_body(row: pd.Series) -> str:
    body = (row.get("fullText") or "").strip()
    if len(body) < 50:
        body = (row.get("content") or "").strip()
    if len(body) < 50:
        body = (row.get("description") or "").strip()
    return body

def parse_pubdate(s: str):
    if not isinstance(s, str): return None
    fmts = ["%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d %H:%M:%S"]
    for f in fmts:
        try:
            return datetime.strptime(s, f)
        except Exception:
            continue
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

def domain_from_url(u: str) -> str:
    try:
        netloc = urlparse(u).netloc
        return netloc.lower()
    except Exception:
        return ""

def clamp(s: str, limit: int) -> str:
    if not isinstance(s, str): s = "" if s is None else str(s)
    s = s.strip()
    return s if len(s) <= limit else s[:limit]

def build_items(df_sel: pd.DataFrame) -> Tuple[str, str, List[int], List[str], List[str], List[str]]:
    metas, bodies, indices, urls, titles, sources = [], [], [], [], [], []
    for _, r in df_sel.iterrows():
        idx = int(r.get("index")) if pd.notna(r.get("index")) else None
        title = (r.get("title") or "").strip()
        url = (r.get("originalUrl") or r.get("naverUrl") or "").strip()
        src = (r.get("source") or "").strip()
        body = prefer_body(r)

        metas.append({
            "index": idx, "title": clamp(title, 140), "url": url,
            "pubDate": r.get("pubDate"), "source": src, "length": len(body)
        })
        bodies.append(f"[{idx}] {title}\n{clamp(body,1200)}\n")

        indices.append(idx); urls.append(url); titles.append(title); sources.append(src)

    return json.dumps(metas, ensure_ascii=False), "\n".join(bodies), indices, urls, titles, sources

def normalize_category(raw_cat: str, title: str, body: str,
                       cluster_majority_raw: str = None,
                       cluster_majority_ko: str = None) -> str:
    """
    1) 클러스터 다수결(있다면) 우선
    2) 영문 원 카테고리 → 한글 4종 매핑
    3) economy는 본문/제목에 해외 힌트가 있으면 '해외경제', 아니면 '국내경제'
    4) 그래도 못 정하면 기존 규칙 기반으로 백업
    """
    txt = f"{title} {body}"
    # 1) 클러스터 다수결 먼저
    if cluster_majority_ko in {"국내경제","해외경제","사회","트렌드"}:
        return cluster_majority_ko

    raw = (raw_cat or "").strip().lower()
    if raw in RAW2KO_BASE:
        return RAW2KO_BASE[raw]
    if raw == "economy":
        if any(k.lower() in txt.lower() for k in GLOBAL_HINTS):
            return "해외경제"
        return "국내경제"

    # ---- 이하: 기존 규칙 기반 백업 ----
    t = txt.lower()
    if any(k in t for k in ["수출","환율","금리","경기","주가","증시","기업","채권","물가","부동산","고용"]):
        if any(k.lower() in t for k in GLOBAL_HINTS):
            return "해외경제"
        return "국내경제"
    if any(k in t for k in ["범죄","사건","사고","경찰","검찰","재판","복지","교육청","지자체","주거","임대","저소득"]):
        return "사회"
    return "트렌드"

def parse_source_field(source_val: str, url_fallback: str) -> Tuple[str, str]:
    s = (source_val or "").strip()
    press, surl = "", ""
    if s:
        # 흔한 구분자 추정
        for sep in ["||","|","::"," - "," — "," —", " — ", " —"]:
            if sep in s:
                parts = [p.strip() for p in s.split(sep, 1)]
                if len(parts) == 2:
                    press, surl = parts[0], parts[1]
                    break
        if not press:
            # 괄호 URL 패턴 시도: "언론사명 (https://...)" 형태
            m = re.search(r"(.*?)[\s\[(（]\s*(https?://[^\s\]）)]+", s)
            if m:
                press = m.group(1).strip()
                surl = m.group(2).strip()
            else:
                press = s

    if not surl:
        surl = url_fallback or ""
    if not press:
        # URL 도메인으로 프레스명 유추
        dom = domain_from_url(surl)
        press = dom if dom else "unknown"

    return press[:100], surl

def ensure_3_sentences(text: str) -> str:
    if not text: return ""
    # 간단한 문장 분리(마침표/물음표/느낌표 + 공백 기준)
    parts = re.split(r'(?<=[\.!?])\s+', text.strip())
    parts = [p for p in parts if p]
    if len(parts) >= 3:
        fixed = " ".join(parts[:3])
    else:
        # 3문장 미만이면 마지막 문장에 마침표 보정하면서 패딩 불가 → 그대로 반환(프롬프트에서 강제했기 때문에 드물 것)
        fixed = " ".join(parts)
        if not fixed.endswith(("。",".","!","?")):
            fixed += "."
    return clamp(fixed, SUMMARY_MAX_CHARS)

@retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8),
       retry=retry_if_exception_type(Exception))
def call_llm(user_prompt: str) -> Dict[str, Any]:
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role":"system","content":SYSTEM_PROMPT},
                  {"role":"user","content":user_prompt}],
        temperature=0.2,
        response_format={"type":"json_object"},
    )
    return json.loads(resp.choices[0].message.content)

def build_image_prompt(title: str, body: str, category: str) -> str:
    """뉴스 썸네일용 포토리얼 프롬프트(장면/구도/조명 가변화)"""
    # ---- 키워드 얕은 추출 ----
    key_candidates = []
    for k in ["수출","환율","금리","경기","주가","증시","기업","채권","물가","부동산","고용",
              "미국","중국","일본","유럽","정책","예산","복지","교육","사건","사고","데이터센터",
              "AI","스마트시티","기후","탄소","에너지","의료","감염병"]:
        if k in title or k in body:
            key_candidates.append(k)
    keys = ", ".join(sorted(set(key_candidates))[:5]) or "뉴스 핵심 주제"

    # ---- 가변 선택을 위한 시드(같은 기사 → 같은 결과, 다른 기사 → 다양성) ----
    seed = int(hashlib.md5(f"{title}|{category}".encode("utf-8")).hexdigest()[:8], 16)
    rnd = random.Random(seed)

    # ---- 카테고리별 '모티프 풀'(넓은 개념의 장면들) ----
    motif_pool = {
        "국내경제": [
            "도심 금융가/업무지구 전경(비식별 인물 소수, 배경 보케)",
            "사무실 책상 위 재무 자료와 계산기(로고/문자 식별 불가)",
            "고층 빌딩 유리 외벽에 비친 도시 풍경(추상적 반사)",
            "제조 현장의 도구·계기판 클로즈업(브랜드/텍스트 없이)",
            "대중교통 출근 인파의 원거리 샷(얼굴 식별 불가)"
        ],
        "해외경제": [
            "항만 컨테이너/크레인 원거리 샷(로고 제거/추상화)",
            "국제 도시 스카이라인과 고가도로의 야간 트래픽 라이트",
            "글로벌 지도 프로젝션 앞 실루엣(사람은 비식별)",
            "컨테이너선 갑판의 구조물 디테일(텍스트/로고 없음)",
            "추상화된 통화/지표 패턴을 배경으로 한 도시 전경"
        ],
        "사회": [
            "법원·행정기관 건물의 외관/계단(사람은 원거리·뒷모습)",
            "지하철역 플랫폼/출구의 생활 장면(비식별 보행자)",
            "학교 복도/교실 빈 책상 등 공공장소 디테일",
            "횡단보도/교차로 상공샷(군중은 작고 식별 불가)",
            "비 오는 거리의 우산과 보행자 실루엣(익명성 유지)"
        ],
        "트렌드": [
            "카페/코워킹스페이스의 테이블 셋업(노트북·기기·소품 위주)",
            "도시 풍경과 함께 보이는 네온/간접조명 실내 장면",
            "모던 인테리어 공간의 제품·소품 클로즈업(브랜드 제거)",
            "데이터센터/서버룸의 복도(로고/식별 텍스트 없음)",
            "야외 스트리트 패션/라이프스타일 실루엣(얼굴 비식별)"
        ]
    }
    scene = rnd.choice(motif_pool.get(category, motif_pool["트렌드"]))

    # ---- 추가로 구도/렌즈/조명도 가변화 ----
    compositions = [
        "로우앵글", "아이레벨", "하이앵글", "대칭 구도", "삼분할 구도", "오버헤드 탑뷰"
    ]
    lenses = ["35mm", "50mm", "85mm"]
    lights = ["자연광", "실내 확산광", "역광 실루엣", "황금시간대(노을빛)", "흐린날 소프트광"]

    comp  = rnd.choice(compositions)
    lens  = rnd.choice(lenses)
    light = rnd.choice(lights)

    # ---- 최종 프롬프트(일러스트 금지, 포토리얼 고정) ----
    return (
        f"[한국어 지시] 다음 주제의 **뉴스 썸네일**을 '실사 사진'처럼 생성하세요.\n"
        f"- 주제(핵심 키워드): {keys}\n"
        f"- 장면 모티프(예시 중 1개 선택해 구체화): {scene}\n"
        f"- 촬영 지시: {comp} 구도, {lens} 렌즈 느낌, {light}, 얕은 피사계심도(배경 약간 아웃포커스), 약한 필름 그레인.\n"
        f"- 금지: 일러스트/벡터/카툰/3D 렌더/아이콘/인포그래픽, 화면 내 텍스트, 브랜드 로고·상표, "
        f"특정 정치인/연예인 등 실존 인물의 식별 가능한 얼굴.\n"
        f"- 인물은 있더라도 등/옆모습 또는 원거리로 비식별 처리.\n"
        f"- 결과물은 일반 뉴스 포털 카드형 썸네일에 적합해야 하며, 실사 사진처럼 보일 것."
    )

def generate_article_image(title: str, body: str, category: str, cluster_id: int) -> str:
    """DALL·E 3로 이미지 생성 → 파일 저장 → 프로젝트 상대경로 문자열 리턴.
       실패/비활성화 시 빈 문자열 리턴."""
    if not ENABLE_IMAGE_GEN:
        return ""
    try:
        prompt = build_image_prompt(title, body, category)
        resp = client.images.generate(
            model=IMAGE_MODEL,
            prompt=prompt,
            size=IMAGE_SIZE,
            response_format="b64_json",   # 파일 저장에 유리
        )
        b64 = resp.data[0].b64_json
        raw = base64.b64decode(b64)
        fname = f"article_{cluster_id}_{int(time.time())}.{IMAGE_FORMAT}"
        fpath = IMG_DIR / fname
        with open(fpath, "wb") as f:
            f.write(raw)

        return f"{PUBLIC_MEDIA_ROUTE}/{fname}"
    except Exception:
        return ""
    
def enforce_bullet_style(text: str) -> str:
    """
    요약을 개조식 3개 조항으로 정리.
    - 조항 구분: ' · '
    - 조항 끝의 마침표/감탄/의문 제거
    - 서술형 어미(~다/~요/~습니다 등) 단순 제거 시도
    """
    if not text:
        return ""

    # 1) 조항 후보 분리: 줄바꿈/세미콜론/가운뎃점/점 등
    parts = re.split(r'(?:\n+|[;•·・ㆍ]|(?<=[\.!?])\s+)', text)
    parts = [p.strip() for p in parts if p and p.strip()]

    # 2) 각 조항 후처리
    cleaned = []
    for s in parts:
        # 끝 구두점 제거
        s = re.sub(r'[\s\.!?…]+$', '', s)

        # 매우 흔한 서술형 어미 제거(과도한 변형은 피하고 단순 컷)
        s = re.sub(r'(?:습니다|하였다|했다|된다|됐다|한다|이다|였다|다|요)$', '', s)

        # 앞뒤 공백 정리
        s = s.strip()

        # 너무 짧으면 스킵
        if len(s) < 2:
            continue

        cleaned.append(s)
        if len(cleaned) == 3:
            break

    # 3) 3개 미만이면 있는 만큼만 반환
    out = " · ".join(cleaned)
    return clamp(out, SUMMARY_MAX_CHARS)
    

def main():
    assert Path(INPUT_CSV).exists(), f"입력 CSV 없음: {INPUT_CSV}"
    df = pd.read_csv(INPUT_CSV)

    required = {"title","originalUrl","naverUrl","description","pubDate","category","content",
            "contentLength","isQualityContent","fullText","textLength","index","cluster","method"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV 컬럼 누락: {missing}")

    # 본문/길이 전처리
    df["__body"] = df.apply(prefer_body, axis=1)
    df["__body_len"] = df["__body"].fillna("").str.len()

    articles_rows = []
    src_unique = {}  # press_name -> source_url (마지막값 유지)
    src_staging_rows = []

    # 군집 루프
    for cluster_id, grp in df.groupby("cluster"):
        grp_all = grp.copy()
        grp = grp_all[grp_all["__body_len"] >= MIN_BODY_CHARS]
        if grp.empty:
            grp = grp_all.sort_values("__body_len", ascending=False).head(3)

        # 대표 문서: 랜덤
        rep = grp.sample(1, random_state=random.randint(0, 10**6)).iloc[0]

        # 컨텍스트 문서: 무작위 섞은 뒤 상위 N개(품질/최신 섞고 싶으면 규칙 바꿔도 됨)
        grp_shuffled = grp.sample(frac=1.0, random_state=42)
        df_sel = grp_shuffled.head(MAX_ARTICLES_PER_CLUSTER)

        items_meta, items_bodies, used_indices, urls, titles, sources = build_items(df_sel)

        user_prompt = USER_PROMPT_TMPL.format(
            items_meta=items_meta,
            items_bodies=(items_bodies[:3500]),
            title_max=TITLE_MAX_CHARS,
            summary_max=SUMMARY_MAX_CHARS,
            rewrite_max=REWRITE_MAX_CHARS
        )

        try:
            out = call_llm(user_prompt)
            gen_title   = clamp(out.get("title",""), TITLE_MAX_CHARS)
            gen_summary = enforce_bullet_style(out.get("summary",""))
            gen_rewrite = clamp(out.get("rewritten_body",""), REWRITE_MAX_CHARS)
        except Exception:
            # 폴백: 대표 문서 기반
            gen_title   = clamp(rep.get("title",""), TITLE_MAX_CHARS)
            base = rep.get("__body") or rep.get("content") or rep.get("description") or ""
            gen_summary = enforce_bullet_style(base[:SUMMARY_MAX_CHARS])
            gen_rewrite = clamp(base, REWRITE_MAX_CHARS)

        # 카테고리 정규화
        norm_cat = normalize_category(
            rep.get("category"),
            gen_title,
            gen_rewrite,
            rep.get("cluster_majority_raw"),
            rep.get("cluster_majority_ko"),
        )

        # 기사 등록 시각(KST)
        reg_at = now_kst_iso()

        image_url = generate_article_image(gen_title, gen_rewrite, norm_cat, int(cluster_id))

        # DB 컬럼과 매핑되는 결과 행(Article 테이블용)
        # article_image_url은 현재 수집 스키마에 없으므로 빈 값
        articles_rows.append({
            "article_title": gen_title,
            "article_summary": gen_summary,
            "article_content": gen_rewrite,
            "article_image_url": image_url,
            "article_category": norm_cat,
            "article_reg_at": reg_at,
            "article_update_at": "",
            "article_like_count": 0,
            "article_rate_avg": 0.0,
            "article_view_count": 0,
            # 추적용(운영 DB엔 미삽입): cluster, used_indices, source_urls
            "cluster": cluster_id,
            "used_indices": ",".join(str(i) for i in used_indices if i is not None),
            "source_urls": ",".join(sorted(set([u for u in urls if u]))),
        })

        # 소스 파싱: 군집에 사용된 각 기사별로 press_name/source_url 확보
        # 이후 Article insert 후 생성된 article_no와 매핑해야 하므로 스테이징에 article_tmp_id를 부여
        article_tmp_id = len(articles_rows)  # 1부터 증가(해당 CSV의 행번호)
        for src_val, url in zip(sources, urls):
            press_name, source_url = parse_source_field(src_val, url)
            if not press_name and not source_url:
                continue
            src_unique[press_name] = source_url
            src_staging_rows.append({
                "article_tmp_id": article_tmp_id,
                "press_name": press_name,
                "source_url": source_url
            })

        time.sleep(SLEEP_BETWEEN_CALLS)

    # 결과 저장
    ts = datetime.utcnow().isoformat().replace(":", "-").replace(".", "-")

    out_articles = pd.DataFrame(articles_rows)
    cluster_csv = OUT_BASE / f"cluster_articles_for_db_{ts}.csv"
    out_articles.to_csv(cluster_csv, index=False, encoding="utf-8-sig")

    out_src_unique = pd.DataFrame(
        [{"press_name": k[:100], "source_url": v} for k, v in src_unique.items()]
    )
    uniq_csv = OUT_BASE / f"article_sources_unique_{ts}.csv"
    out_src_unique.to_csv(uniq_csv, index=False, encoding="utf-8-sig")

    out_src_staging = pd.DataFrame(src_staging_rows)
    staging_csv = OUT_BASE / f"article_sources_staging_{ts}.csv"
    out_src_staging.to_csv(staging_csv, index=False, encoding="utf-8-sig")

    print(f"완료: {cluster_csv} ({len(out_articles)} rows)")
    print(f"완료: {uniq_csv} ({len(out_src_unique)} unique sources)")
    print(f"완료: {staging_csv} ({len(out_src_staging)} mappings)")
    
if __name__ == "__main__":
    main()