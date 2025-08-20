import os, json, time, random, re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Tuple
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv

import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import OpenAI

# 입력/출력 경로
HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[2]
IN_BASE  = PROJECT_ROOT / "model" / "results" / "cluster_results"
OUT_BASE = PROJECT_ROOT / "model" / "results" / "generate_results"

def _latest_cluster_csv() -> str:
    files = sorted(
        IN_BASE.glob("clustering_results_detailed_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    return str(files[0]) if files else str(IN_BASE / "clustering_results_detailed.csv")

INPUT_CSV = os.getenv("INPUT_CSV", _latest_cluster_csv())

OUT_CLUSTER_CSV     = os.getenv("OUT_CLUSTER_CSV",     str(OUT_BASE / "cluster_articles_for_db.csv"))
OUT_SRC_UNIQ_CSV    = os.getenv("OUT_SRC_UNIQ_CSV",    str(OUT_BASE / "article_sources_unique.csv"))
OUT_SRC_STAGING_CSV = os.getenv("OUT_SRC_STAGING_CSV", str(OUT_BASE / "article_sources_staging.csv"))

load_dotenv(find_dotenv(), override=True)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다. .env 또는 환경변수를 확인하세요.")
client = OpenAI(api_key=OPENAI_API_KEY)

# 생성 길이 제한
TITLE_MAX_CHARS   = int(os.getenv("TITLE_MAX_CHARS",   "60"))
SUMMARY_MAX_CHARS = int(os.getenv("SUMMARY_MAX_CHARS", "300"))
REWRITE_MAX_CHARS = int(os.getenv("REWRITE_MAX_CHARS", "1300"))

# 컨텍스트 문서 수, 노이즈 컷오프
MAX_ARTICLES_PER_CLUSTER = int(os.getenv("MAX_ARTICLES_PER_CLUSTER", "5"))
MIN_BODY_CHARS = int(os.getenv("MIN_BODY_CHARS", "200"))
SLEEP_BETWEEN_CALLS = float(os.getenv("SLEEP_BETWEEN_CALLS", "0.4"))

# 카테고리 4종
CATS = {"국내경제","해외경제","사회","트렌드"}

SYSTEM_PROMPT = (
    "당신은 한국어 뉴스 다문서 요약 어시스턴트입니다. "
    "20~30대도 빠르게 이해하도록 쉬운 문장, 핵심 위주, 과장/추측 금지. "
    "날짜·수치·기관명 등 사실 정보는 보존하고, 상충 시 출처에 근거해 신중하게 기술합니다. "
    "출력은 반드시 JSON 하나만 반환하세요."
)

USER_PROMPT_TMPL = """다음은 같은 군집의 여러 기사입니다. 이들을 하나의 아티클로 통합하세요.

[기사 목록(요약 메타)]
{items_meta}

[기사 원문 스니펫(최대 3500자)]
{items_bodies}

요구사항:
1) 제목: 핵심을 압축, {title_max}자 이내
2) 요약문: 정확히 3문장, 팩트 위주, {summary_max}자 이내, 개조식 단어체 사용
3) 재가공 본문: 배경→핵심 사실→의미/쟁점 순 기사체, {rewrite_max}자 이내, 경어체 사용
4) 중복/광고/댓글 흔적 제거, 불확실 정보는 단정 금지
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

def normalize_category(raw_cat: str, title: str, body: str) -> str:
    raw = (raw_cat or "").strip()
    if raw in CATS:
        return raw
    t = f"{title} {body}".lower()

    # 간단 규칙 기반 매핑
    if any(k in t for k in ["수출","환율","금리","경기","주가","증시","기업","채권","물가","부동산","고용"]):
        # 국내 vs 해외 힌트
        if any(k in t for k in ["미국","중국","일본","eu","유럽","세계","글로벌","월가","fed","boj","ecb"]):
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
            rewrite_max=REWRITE_MAX_CHARS,
        )

        try:
            out = call_llm(user_prompt)
            gen_title   = clamp(out.get("title",""), TITLE_MAX_CHARS)
            gen_summary = ensure_3_sentences(out.get("summary",""))
            gen_rewrite = clamp(out.get("rewritten_body",""), REWRITE_MAX_CHARS)
        except Exception:
            # 폴백: 대표 문서 기반
            gen_title   = clamp(rep.get("title",""), TITLE_MAX_CHARS)
            base = rep.get("__body") or rep.get("content") or rep.get("description") or ""
            gen_summary = ensure_3_sentences(base[:SUMMARY_MAX_CHARS])
            gen_rewrite = clamp(base, REWRITE_MAX_CHARS)

        # 카테고리 정규화(4종으로 강제)
        norm_cat = normalize_category(rep.get("category"), gen_title, gen_rewrite)

        # 기사 등록 시각(KST)
        reg_at = now_kst_iso()

        # DB 컬럼과 매핑되는 결과 행(Article 테이블용)
        # article_image_url은 현재 수집 스키마에 없으므로 빈 값
        articles_rows.append({
            "article_title": gen_title,
            "article_summary": gen_summary,
            "article_content": gen_rewrite,
            "article_image_url": "",
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

    print(f"완료: {OUT_CLUSTER_CSV} ({len(out_articles)} rows)")
    print(f"완료: {OUT_SRC_UNIQ_CSV} ({len(out_src_unique)} unique sources)")
    print(f"완료: {OUT_SRC_STAGING_CSV} ({len(out_src_staging)} mappings)")
    
if __name__ == "__main__":
    main()