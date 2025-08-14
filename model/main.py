import os
import sys
from pathlib import Path
import importlib

HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[1]
PIPE_DIR = PROJECT_ROOT / "model" / "main_pipeline"

sys.path.insert(0, str(PIPE_DIR))

def run_collector():
    mod = importlib.import_module("news_collector")
    print("\n[1/4] 뉴스 수집 시작")
    mod.main()
    print("[1/4] 뉴스 수집 완료")

def run_cluster():
    mod = importlib.import_module("news_cluster")
    print("\n[2/4] 임베딩 + 군집화 시작")
    mod.main()
    print("[2/4] 임베딩 + 군집화 완료")

def run_generator():
    mod = importlib.import_module("articles_generator")
    print("\n[3/4] GPT 요약 생성 시작")
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY가 없어 요약 단계를 진행할 수 없습니다.")
    mod.main()
    print("[3/4] GPT 요약 생성 완료")

def run_db_save():
    mod = importlib.import_module("database_saver")
    print("\n[4/4] DB 저장 시작 (MySQL / Cloud SQL)")
    mode = "Cloud SQL Connector" if os.getenv("INSTANCE_CONNECTION_NAME") else "PyMySQL direct/proxy"
    print(f" - 연결 모드: {mode}")
    if not os.getenv("INSTANCE_CONNECTION_NAME"):
        required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME"]
        missing = [k for k in required if not os.getenv(k)]
        if missing:
            print(f"   경고: 환경변수 누락 {missing} → .env 또는 환경변수로 설정하세요.")
    mod.main()
    print("[4/4] DB 저장 완료")

def main():
    results_dir = PROJECT_ROOT / "model" / "results"
    for sub in ("collect_results", "cluster_results", "generate_results"):
        (results_dir / sub).mkdir(parents=True, exist_ok=True)

    try:
        run_collector()
        run_cluster()
        run_generator()
        run_db_save()
    except Exception as e:
        print(f"\n❌ 파이프라인 실패: {type(e).__name__}: {e}")
        raise

if __name__ == "__main__":
    main()