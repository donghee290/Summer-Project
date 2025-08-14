from pathlib import Path
import pandas as pd
import re

ROOT = Path(__file__).resolve().parents[1]
gen_dir = ROOT / "results" / "generate_results"
clu_dir = ROOT / "results" / "cluster_results"

req_files = [
    gen_dir / "cluster_articles_for_db.csv",
    gen_dir / "article_sources_unique.csv",
    gen_dir / "article_sources_staging.csv",
    clu_dir / "clustering_results_detailed.csv",
]
missing_fs = [str(p) for p in req_files if not p.exists()]
if missing_fs:
    raise FileNotFoundError("누락된 파일:\n" + "\n".join(missing_fs))

arts = pd.read_csv(req_files[0])
uniq = pd.read_csv(req_files[1])
stg  = pd.read_csv(req_files[2])
src  = pd.read_csv(req_files[3])

# 1) 필수 컬럼
required = {"article_title","article_summary","article_content","article_category",
            "article_reg_at","cluster","used_indices","source_urls"}
missing = required - set(arts.columns)
print("missing cols:", missing)

# 2) 길이/문장 수
def sentence_count(s: str) -> int:
    parts = re.split(r'(?<=[\.!?])\s+', str(s).strip())
    parts = [p for p in parts if p]
    return len(parts)

print("title_len_ok:", (arts.article_title.fillna("").str.len()<=60).all())
print("summary_len_ok:", (arts.article_summary.fillna("").str.len()<=300).all())
print("summary_3sent_ok:", (arts.article_summary.fillna("").map(sentence_count)==3).all())
print("body_len_ok:", (arts.article_content.fillna("").str.len()<=1300).all())

# 3) 카테고리
valid_cats = {"국내경제","해외경제","사회","트렌드"}
print("category_ok:", arts.article_category.isin(valid_cats).all())

# 4) 행 수 = 클러스터 수
n_arts = len(arts)
n_clusters = src["cluster"].nunique()
print("rows == n_clusters ?", n_arts, n_clusters, n_arts==n_clusters)

# 5) 소스 매핑 일관성
ok_tmp_range = stg["article_tmp_id"].between(1, n_arts).all()
print("staging tmp_id in range:", ok_tmp_range)

has_press = (uniq["press_name"].fillna("") != "")
has_url   = (uniq["source_url"].fillna("") != "")
print("unique sources non-empty:", (has_press | has_url).any())

bad_rows = uniq[~(has_press & has_url)]
print("rows with missing press or url:", len(bad_rows))
if len(bad_rows):
    print(bad_rows.head(10))

# 요약 3문장 아닌 행 샘플
bad = arts[arts["article_summary"].fillna("").map(sentence_count) != 3]
print("not 3 sentences rows:", len(bad))
if len(bad):
    print(bad[["article_title","article_summary"]].head(5))