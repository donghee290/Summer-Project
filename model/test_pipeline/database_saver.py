import os
import pandas as pd
from pathlib import Path
from typing import List, Tuple

import pymysql
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(), override=True)

HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[2]
GEN_DIR = PROJECT_ROOT / "model" / "results" / "generate_results"

def _latest_or_default(glob_pat: str, default_name: str) -> Path:
    files = sorted(GEN_DIR.glob(glob_pat), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else (GEN_DIR / default_name)

ARTICLES_CSV  = _latest_or_default("cluster_articles_for_db_*.csv", "cluster_articles_for_db.csv")
UNIQUE_SRC_CSV = _latest_or_default("article_sources_unique_*.csv", "article_sources_unique.csv")
STAGING_CSV    = _latest_or_default("article_sources_staging_*.csv", "article_sources_staging.csv")
DIGEST_CSV    = _latest_or_default("daily_digest_staging_*.csv", "daily_digest_staging.csv")

# ---- Cloud SQL Connector (옵션) ----
USE_CONNECTOR = bool(os.getenv("INSTANCE_CONNECTION_NAME"))
connector = None

def get_connection():
    """PyMySQL 직결(기본) 또는 Cloud SQL Connector로 커넥션 생성."""
    global connector
    if USE_CONNECTOR:
        from google.cloud.sql.connector import Connector, IPTypes
        connector = Connector()

        instance = os.getenv("INSTANCE_CONNECTION_NAME")
        use_private = os.getenv("DB_PRIVATE_IP", "false").lower() == "true"
        enable_iam = os.getenv("DB_IAM_AUTH", "false").lower() == "true"

        def _connect():
            return connector.connect(
                instance_connection_string=instance,
                driver="pymysql",
                user=os.getenv("DB_USER", "root"),
                password=None if enable_iam else os.getenv("DB_PASSWORD", ""),
                db=os.getenv("DB_NAME", "newsdb"),
                ip_type=IPTypes.PRIVATE if use_private else IPTypes.PUBLIC,
                enable_iam_auth=enable_iam,
            )
        return _connect()
    else:
        return pymysql.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "newsdb"),
            charset="utf8mb4",
            autocommit=False,
        )

def _exists_all(paths: List[Path]) -> Tuple[bool, List[Path]]:
    missing = [p for p in paths if not p.exists()]
    return (len(missing) == 0, missing)

def _round_to_1_decimal(x) -> float:
    try:
        return round(float(x), 1)
    except Exception:
        return 0.0

def _int_or_zero(x) -> int:
    try:
        return int(x)
    except Exception:
        return 0

def _none_if_blank(x):
    try:
        import pandas as pd
        if x is None or pd.isna(x):
            return None
    except Exception:
        if x is None:
            return None
    s = str(x).strip()
    if s == "" or s.lower() in {"nan", "none", "null"}:
        return None
    return s

def _chunked(iterable, size=1000):
    for i in range(0, len(iterable), size):
        yield iterable[i:i+size]

def main():
    ok, missing = _exists_all([ARTICLES_CSV, UNIQUE_SRC_CSV, STAGING_CSV, DIGEST_CSV])
    if not ok:
        raise FileNotFoundError("누락된 CSV 파일:\n" + "\n".join(str(p) for p in missing))

    arts = pd.read_csv(ARTICLES_CSV)
    uniq = pd.read_csv(UNIQUE_SRC_CSV)
    stg  = pd.read_csv(STAGING_CSV)
    digest = pd.read_csv(DIGEST_CSV)

    # 빈 press/url 제거
    uniq["press_name"] = uniq["press_name"].fillna("").map(str).str.strip()
    uniq["source_url"] = uniq["source_url"].fillna("").map(str).str.strip()
    uniq = uniq[(uniq["press_name"] != "") | (uniq["source_url"] != "")]
    uniq = uniq.drop_duplicates(subset=["press_name"], keep="last")

    print(f"[LOAD] articles={len(arts)}, unique_sources={len(uniq)}, staging_rows={len(stg)}")
    print(f"[DB] mode={'Cloud SQL Connector' if USE_CONNECTOR else 'PyMySQL direct/proxy'}")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # --- 1) Article INSERT ---
            sql_art = """
            INSERT INTO Article
            (article_title, article_summary, article_content, article_image_url,
             article_category, article_reg_at, article_update_at,
             article_like_count, article_rate_avg, article_view_count)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            tmpid_to_real = {}
            for i, r in arts.iterrows():
                upd_at = _none_if_blank(r.get("article_update_at"))
                cur.execute(sql_art, (
                    str(r.get("article_title","") or "")[:255],
                    str(r.get("article_summary","") or "")[:500],
                    str(r.get("article_content","") or ""),
                    str(r.get("article_image_url","") or "")[:500],
                    str(r.get("article_category","") or "")[:50],
                    str(r.get("article_reg_at","") or ""),  # 'YYYY-MM-DD HH:MM:SS' 형식
                    upd_at,
                    _int_or_zero(r.get("article_like_count", 0)),
                    _round_to_1_decimal(r.get("article_rate_avg", 0.0)),
                    _int_or_zero(r.get("article_view_count", 0)),
                ))
                tmp_id_csv = r.get("article_tmp_id")
                try:
                    tmp_id = int(tmp_id_csv) if pd.notna(tmp_id_csv) else (i + 1)
                except Exception:
                    tmp_id = i + 1
                tmpid_to_real[tmp_id] = cur.lastrowid  # CSV의 article_tmp_id 우선, 없으면 enumerate 기반

            # --- 2) Article_Source UPSERT (press_name UNIQUE) ---
            sql_src = """
            INSERT INTO Article_Source (press_name, source_url)
            VALUES (%s,%s)
            ON DUPLICATE KEY UPDATE source_url = VALUES(source_url)
            """
            src_rows = list(uniq[["press_name","source_url"]].itertuples(index=False, name=None))
            for batch in _chunked(src_rows, 1000):
                cur.executemany(sql_src, batch)

            # press_name -> source_no 맵
            cur.execute("SELECT source_no, press_name FROM Article_Source")
            key_to_sid = {row[1]: row[0] for row in cur.fetchall()}

            # --- 3) Article_Source_Map INSERT IGNORE ---
            sql_map = "INSERT IGNORE INTO Article_Source_Map (article_no, source_no) VALUES (%s,%s)"
            map_rows = []
            for _, r in stg.iterrows():
                tmp_id = _int_or_zero(r.get("article_tmp_id"))
                press  = str(r.get("press_name","") or "").strip()
                if tmp_id in tmpid_to_real and press in key_to_sid:
                    map_rows.append((tmpid_to_real[tmp_id], key_to_sid[press]))

            for batch in _chunked(map_rows, 2000):
                cur.executemany(sql_map, batch)

        conn.commit()
        # --- 4) DailyDigest UPSERT ---
        if 'article_tmp_id' not in arts.columns:
            print("[WARN] articles CSV에 'article_tmp_id' 컬럼이 없습니다. DailyDigest 매핑을 건너뜁니다.")
        else:
            if digest.empty:
                print("[SKIP] DailyDigest 스테이징 CSV가 비어 있습니다.")
            else:
                sql_digest = """
                INSERT INTO DailyDigest (ref_date, category, line_no, article_no, one_line_summary)
                VALUES (%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    one_line_summary = VALUES(one_line_summary),
                    article_no = VALUES(article_no)
                """
                digest_rows_db = []
                for _, r in digest.iterrows():
                    ref_date = str(r.get('ref_date', '') or '')
                    category = str(r.get('category', '') or '')
                    try:
                        line_no = int(r.get('line_no', 0) or 0)
                    except Exception:
                        line_no = 0
                    try:
                        tmp_id = int(r.get('article_tmp_id', 0) or 0)
                    except Exception:
                        tmp_id = 0
                    one_line = str(r.get('one_line_summary', '') or '')[:255]

                    real_id = tmpid_to_real.get(tmp_id)
                    if not real_id:
                        # 매핑되지 않은 경우 스킵
                        continue

                    if ref_date and category and line_no > 0:
                        digest_rows_db.append((ref_date, category, line_no, real_id, one_line))

                if digest_rows_db:
                    with conn.cursor() as cur2:
                        cur2.executemany(sql_digest, digest_rows_db)
                    conn.commit()
                    print(f"[OK] DailyDigest upsert 완료 (rows={len(digest_rows_db)})")
                else:
                    print("[SKIP] DailyDigest 입력할 행이 없습니다.")

        print(f"[OK] DB 저장 완료 "
              f"(articles={len(arts)}, sources upsert={len(uniq)}, mappings inserted={len(map_rows)})")

    except Exception as e:
        conn.rollback()
        print(f"[ERR] 롤백됨: {type(e).__name__}: {e}")
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass
        if connector is not None:
            try:
                connector.close()
            except Exception:
                pass

if __name__ == "__main__":
    main()