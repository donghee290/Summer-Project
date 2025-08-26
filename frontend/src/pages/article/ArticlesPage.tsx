import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTopIssuesStore } from "../../store/topIssuesStore";
import { getYesterdayKSTRange } from "../../utils/dateRange";
import type { TopCategory } from "../../api/article/articleApi";

export default function ArticlesPage() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const activeCat: TopCategory =
    path.includes("/globaleconomy") ? "해외경제" :
    path.includes("/society")       ? "사회"     :
    path.includes("/trend")         ? "트렌드"   :
    "국내경제"; // default: /koreaeconomy

  const { byCat, loading, loadYesterdayTop3 } = useTopIssuesStore();
  useEffect(() => { loadYesterdayTop3(activeCat); }, [activeCat, loadYesterdayTop3]);

  const { dateFrom, dateTo } = getYesterdayKSTRange();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{activeCat} — 어제의 Top3</h1>
        <p className="text-sm text-gray-500">
          {dateFrom.slice(0,10)} ~ {dateTo.slice(0,10)}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3 items-center min-h-[28px]">
        {loading && <span className="text-sm text-gray-500">어제의 Top3 불러오는 중…</span>}
        {!loading && (byCat[activeCat]?.length ?? 0) === 0 &&
          <span className="text-sm text-gray-400">어제 주요 이슈가 없어요.</span>}
        {(byCat[activeCat] ?? []).map(it => (
          <Link
            key={it.article_no}
            to={`/articles/${it.article_no}`}
            className="text-sm hover:underline truncate max-w-[32%] block"
            title={it.headline}
          >
            • {it.headline}
          </Link>
        ))}
      </div>

      {/* 여기에 해당 카테고리의 일반 기사 목록을 추가로 렌더링할 수 있습니다. */}
    </div>
  );
}
