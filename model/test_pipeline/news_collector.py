# -*- coding: utf-8 -*-
import os, re, json, time, errno, logging, argparse
from datetime import datetime, timedelta
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv, find_dotenv
from pathlib import Path

# --- 로깅 ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# --- 환경변수 로드: 어느 디렉토리에서 실행해도 naverapi.env / .env 자동탐색 ---
load_dotenv(find_dotenv(filename="naverapi.env"), override=True)
load_dotenv(find_dotenv(), override=True)

HERE = Path(__file__).resolve()
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_OUTDIR = str(BASE_DIR / "model" / "results" / "collect_results")

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/114.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA}

KEYWORDS = {
    "economy": ["경제","금융","주식","부동산","기업","경기","투자","증시"],
    "society": ["사회","정치","법원","검찰","사건","사고","교육","복지"],
    "entertainment": ["연예","연예인","방송","영화","드라마","음악","K-pop","스타"],
}

DOMAIN_SELECTORS = {
    "chosun.com": ".news_text",
    "joins.com": "#article_body",
    "donga.com": ".article_txt",
    "hani.co.kr": ".text",
    "khan.co.kr": "#articleBody",
    "yna.co.kr": ".article-text",
    "ytn.co.kr": ".paragraph",
}

MSG_TOO_SHORT = "본문이 너무 짧거나 의미가 없습니다."
MSG_AD = "광고성 내용이 많이 포함되어 있습니다."
MSG_CRAWL_FAIL = "본문 크롤링 실패"
MSG_NOT_FOUND = "본문을 가져올 수 없습니다."
DROP_SET = {MSG_TOO_SHORT, MSG_AD, MSG_CRAWL_FAIL, MSG_NOT_FOUND}

def mkdir_p(p: str):
    try: os.makedirs(p, exist_ok=True)
    except OSError as e:
        if e.errno != errno.EEXIST: raise

def strip_html(text: str) -> str:
    soup = BeautifulSoup(text or "", "html.parser")
    return soup.get_text(strip=True)

def resolve_crawl_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        if parsed.hostname and "naver.com" in parsed.hostname and "/article/" in parsed.path:
            return url
        oid = re.search(r"oid=(\d+)", url)
        aid = re.search(r"aid=(\d+)", url)
        if oid and aid:
            return f"https://news.naver.com/main/read.naver?oid={oid.group(1)}&aid={aid.group(1)}"
        return url
    except Exception:
        return url

def search_news(keyword: str, display: int):
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        logging.error("NAVER API 자격증명이 없습니다. naverapi.env 또는 .env 확인(NAVER_CLIENT_ID/SECRET).")
        return []
    try:
        r = requests.get(
            "https://openapi.naver.com/v1/search/news.json",
            headers={
                "X-Naver-Client-Id": NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
                **HEADERS
            },
            params={"query": keyword, "display": display, "start": 1, "sort": "date"},
            timeout=10,
        )
        if r.status_code != 200:
            logging.error(f"[API {keyword}] status={r.status_code} body={r.text[:300]}")
            return []
        data = r.json()
        items = data.get("items", []) or []
        logging.info(f'[API {keyword}] {len(items)}건 수신 (status=200)')
        return items
    except Exception as e:
        logging.error(f'[API {keyword}] 호출 오류: {e}')
        return []

def clean_text(content: str) -> str:
    if not content or len(content) < 50: return content
    content = re.sub(r"\s+", " ", content)
    patterns = [
        r"기자\s*[가-힣]+\s*\S*@\S+", r"\[.*?기자\]", r"ⓒ.*?무단.*?금지", r"저작권자.*?무단.*?배포.*?금지",
        r"\[광고\]", r"\[AD\]", r"관련기사|더보기.*?클릭|▶.*?바로가기|>.*?클릭",
        r"댓글.*?입력.*?|BEST댓글.*?", r"랭킹\s*뉴스|TOP이슈|실시간 뉴스|매체정보|기사제보",
        r"정치\s*사회\s*경제.*?윤리강령.*?출처=", r"대표전화.*?등록번호.*?무단.*?금지",
    ]
    for p in patterns:
        content = re.sub(p, "", content, flags=re.IGNORECASE)
    content = re.sub(r"^[^\w가-힣]+|[^\w가-힣.!?]+$", "", content)
    content = re.sub(r"\.{3,}", "...", content)
    content = re.sub(r"[!?]{2,}", "!", content)
    content = re.sub(r"\s{2,}", " ", content).strip()
    return content

def is_ad_content(content: str) -> bool:
    kws = ["광고","할인","이벤트","쿠폰","혜택","특가","세일","프로모션"]
    cnt = sum(content.count(k) for k in kws)
    return len(content) < 500 and cnt > 2

def _selector_for(host: str):
    if not host: return None
    for dom, sel in DOMAIN_SELECTORS.items():
        if dom in host: return sel
    return None

def _clean_node(node: BeautifulSoup):
    for sel in [
        "script","style",".ad",".advertisement",".related",".tag",".btn","button",".share",".social",
        '[class*="ad"]','[class*="banner"]','[id*="ad"]','[id*="banner"]',
        ".journalist",".reporter",".copyright",".source"
    ]:
        for n in node.select(sel):
            n.decompose()

def get_news_content(url: str) -> str:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            logging.warning(f"[CRAWL] {resp.status_code} {url}")
            return MSG_CRAWL_FAIL
        soup = BeautifulSoup(resp.text, "html.parser")
        host = (urlparse(url).hostname or "").lower()
        text = ""

        # 1) 도메인 맞춤
        sel = _selector_for(host)
        if sel:
            nodes = soup.select(sel)
            if nodes:
                node = nodes[0]; _clean_node(node)
                text = node.get_text(strip=True)

        # 2) 네이버 공통
        if not text and "news.naver.com" in host:
            for s in ["#newsct_article", "#articleBodyContents", ".se_component_wrap", "#articeBody"]:
                nodes = soup.select(s)
                if nodes:
                    node = nodes[0]; _clean_node(node)
                    text = node.get_text(strip=True)
                    if text: break

        # 3) 일반 선택자
        if not text:
            for s in ["article",".article-content",".news-content",".article_body",
                      "#article-view-content-div",".view_txt",".article-text"]:
                nodes = soup.select(s)
                if nodes:
                    node = nodes[0]; _clean_node(node)
                    text = node.get_text(strip=True)
                    if text and len(text) > 100: break

        if text:
            text = clean_text(text)
            if len(text) < 200: return MSG_TOO_SHORT
            if is_ad_content(text): return MSG_AD
            return text
        return MSG_NOT_FOUND
    except Exception as e:
        logging.error(f"[CRAWL ERR] {url} {e}")
        return MSG_CRAWL_FAIL

def filter_recent(items, hours_back: int):
    now = datetime.now()
    cutoff = now - timedelta(hours=hours_back)
    kept = []
    for it in items:
        pub = it.get("pubDate")
        if not pub: continue
        dt = None
        for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
            try:
                dt = datetime.strptime(pub, fmt); break
            except Exception:
                continue
        if not dt: continue
        if dt.replace(tzinfo=None) >= cutoff:
            kept.append(it)
    return kept

def dedupe(items):
    seen, out = set(), []
    for it in items:
        link = it.get("link")
        if not link or link in seen: continue
        seen.add(link); out.append(it)
    return out

def collect_by_category(category: str, keywords, display: int, hours: int,
                        do_crawl: bool, fallback_desc: bool, sleep_sec: float):
    logging.info(f"\n[{category}] 수집 시작: keywords={len(keywords)} display={display} hours={hours} crawl={do_crawl}")
    all_items = []
    for kw in keywords:
        items = search_news(kw, display=display)
        all_items.extend(items)
        time.sleep(0.1)
    logging.info(f"[{category}] API 수신 합계: {len(all_items)}")

    all_items = dedupe(all_items)
    logging.info(f"[{category}] 중복 제거 후: {len(all_items)}")

    recent = filter_recent(all_items, hours_back=hours)
    logging.info(f"[{category}] 최근 {hours}시간 내: {len(recent)}")

    news = []
    succ = qual = 0
    if not do_crawl:
        # 본문 크롤링 생략 (API 통신만 점검용)
        for it in recent:
            news.append({
                "title": strip_html(it.get("title")),
                "originalUrl": it.get("link"),
                "naverUrl": resolve_crawl_url(it.get("link")),
                "description": strip_html(it.get("description")),
                "pubDate": it.get("pubDate"),
                "category": category,
                "content": "",
                "contentLength": 0,
                "isQualityContent": False
            })
        logging.info(f"[{category}] no-crawl 모드: {len(news)}건 기록")
        return news

    # 본문 크롤링 수행
    for i, it in enumerate(recent, 1):
        orig = it.get("link")
        naver = resolve_crawl_url(orig)
        url = naver or orig
        logging.info(f"[{category}] [{i}/{len(recent)}] 크롤링: {url}")
        txt = get_news_content(url)

        if txt and txt not in DROP_SET:
            succ += 1
            isq = len(txt) > 500
            qual += 1 if isq else 0
            news.append({
                "title": strip_html(it.get("title")),
                "originalUrl": orig,
                "naverUrl": naver,
                "description": strip_html(it.get("description")),
                "pubDate": it.get("pubDate"),
                "category": category,
                "content": txt,
                "contentLength": len(txt),
                "isQualityContent": isq
            })
        elif fallback_desc:
            # 본문 실패시 description으로 폴백(디버그/연결 테스트용)
            desc = strip_html(it.get("description") or "")
            if len(desc) >= 50:
                news.append({
                    "title": strip_html(it.get("title")),
                    "originalUrl": orig,
                    "naverUrl": naver,
                    "description": desc,
                    "pubDate": it.get("pubDate"),
                    "category": category,
                    "content": desc,
                    "contentLength": len(desc),
                    "isQualityContent": False
                })
        time.sleep(sleep_sec)

    logging.info(f"[{category}] 본문 수집 완료: 성공 {succ}/{len(recent)} (양질 {qual})")
    return news

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=1, help="최근 N시간 내만 수집")
    ap.add_argument("--display", type=int, default=50, help="키워드별 API 반환 개수(최대 100)")
    ap.add_argument("--sleep", type=float, default=1.0, help="크롤링 간 딜레이(초)")
    ap.add_argument("--no-crawl", action="store_true", help="본문 크롤링 생략(통신 점검용)")
    ap.add_argument("--fallback-description", action="store_true", help="본문 실패 시 description을 본문으로 사용")
    ap.add_argument("--outdir", default=DEFAULT_OUTDIR, help="결과 저장 폴더")
    args = ap.parse_args()

    logging.info("=== 네이버 뉴스 수집기 (디버그 옵션 포함) ===")
    logging.info(f"env loaded -> CLIENT_ID exists? {bool(NAVER_CLIENT_ID)} SECRET exists? {bool(NAVER_CLIENT_SECRET)}")

    collected = {"economy": [], "society": [], "entertainment": []}
    for cat, kws in KEYWORDS.items():
        collected[cat] = collect_by_category(
            category=cat, keywords=kws, display=args.display, hours=args.hours,
            do_crawl=not args.no_crawl, fallback_desc=args.fallback_description, sleep_sec=args.sleep
        )

    total = sum(len(v) for v in collected.values())
    succ = sum(sum(1 for it in v if it.get("content") and it.get("content") not in DROP_SET) for v in collected.values())
    qual = sum(sum(1 for it in v if it.get("isQualityContent")) for v in collected.values())

    result = {
        "collectedAt": datetime.utcnow().isoformat() + "Z",
        "timeRange": f"최근 {args.hours}시간",
        "totalCount": total,
        "contentSuccessCount": succ,
        "qualityContentCount": qual,
        "categories": {k: len(v) for k, v in collected.items()},
        "news": collected
    }

    mkdir_p(args.outdir)
    ts = datetime.utcnow().isoformat().replace(":", "-").replace(".", "-")
    out = os.path.join(args.outdir, f"news_collected_{args.hours}h_{ts}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logging.info(f"\n저장 완료: {out}")
    logging.info(json.dumps({**result, "news": "omitted-for-logs"}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()