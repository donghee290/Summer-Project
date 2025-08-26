// src/pages/article/ArticleDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useArticleStore } from '../../store/articleStore';

type UIArticle = {
  article_no: number;
  title: string;
  press?: string;
  reg_at?: string;
  content: string;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
};

// 안전한 숫자 변환
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// 객체인지 판별
function isObj(x: unknown): x is Record<string, any> {
  return !!x && typeof x === 'object';
}

// 주어진 값에서 “아티클로 보이는 오브젝트” 하나를 찾아 반환
function pickArticleLike(x: any): any | null {
  if (!x) return null;

  // 흔한 래핑들 순회: data.data.article[0] / data.article[0] / article[0] / article / articles[0] / 1단계 평탄화 등
  const candidates: any[] = [];

  if (isObj(x.data)) candidates.push(x.data);
  if (isObj(x.data?.data)) candidates.push(x.data.data);

  candidates.push(x);

  for (const c of candidates) {
    if (!c) continue;

    if (Array.isArray(c.article) && c.article.length) return c.article[0];
    if (isObj(c.article)) return c.article;

    if (Array.isArray(c.articles) && c.articles.length) return c.articles[0]; // 혹시 목록형으로 온 경우

    // 평탄화된 형태(키들 직접 보유)
    if (isObj(c) && ('article_no' in c || 'article_title' in c || 'headline' in c)) {
      return c;
    }
  }
  return null;
}

// 다양한 백엔드 키를 프론트 UIArticle로 정규화
function normalize(detail: any): UIArticle | null {
  const a = pickArticleLike(detail);
  if (!a) return null;

  const article_no = toNum(a.article_no);
  if (!Number.isFinite(article_no)) return null;

  const title =
    a.headline ??
    a.article_title ??
    a.title ??
    '';

  const content =
    a.article_content ??
    a.content ??
    '';

  const press =
    a.article_press ??
    a.press ??
    '';

  const reg_at =
    a.article_reg_at ??
    a.reg_at ??
    a.published_at ??
    '';

  const likeCount =
    toNum(a.likeCount ?? a.article_like_count) || 0;

  // userInteractions 래핑도 고려
  const uiWrap =
    detail?.data?.userInteractions ??
    detail?.userInteractions ??
    a.userInteractions ??
    null;

  const liked = !!(a.liked ?? uiWrap?.liked);
  const bookmarked = !!(a.bookmarked ?? uiWrap?.bookmarked);

  return {
    article_no,
    title,
    press,
    reg_at,
    content,
    likeCount,
    liked,
    bookmarked,
  };
}

export default function ArticleDetailPage() {
  const { id, articleNo } = useParams<{ id?: string; articleNo?: string }>();
  const routeId = useMemo(() => toNum(id ?? articleNo), [id, articleNo]);

  const { detail, loading, error, loadDetail, toggleLike, toggleBookmark, rate } =
    useArticleStore();

  const [ui, setUi] = useState<UIArticle | null>(null);

  useEffect(() => {
    if (Number.isFinite(routeId)) {
      loadDetail(routeId);
    }
  }, [routeId, loadDetail]);

  useEffect(() => {
    setUi(normalize(detail));
  }, [detail]);

  if (loading) return <div className="p-6">불러오는 중…</div>;
  if (error) return <div className="p-6 text-red-600">에러: {error}</div>;
  if (!ui) {
    return (
      <div className="p-6">
        아티클을 찾을 수 없습니다.
        {/* 디버깅용: detail 원본 구조를 접어서 확인 */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-gray-600">원본 detail 보기 (디버깅)</summary>
          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  const onLike = () => toggleLike(ui.article_no);
  const onBookmark = () => toggleBookmark(ui.article_no);
  const onRate5 = () => rate(ui.article_no, 5);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-2">{ui.title}</h1>
      <div className="text-sm text-gray-500 mb-4">
        {ui.press ? `${ui.press} · ` : ''}
        {ui.reg_at ? new Date(ui.reg_at).toLocaleString() : ''}
      </div>

      {ui.content && (
        <div className="prose max-w-none whitespace-pre-wrap mb-6">
          {ui.content}
        </div>
      )}

      <div className="flex gap-3">
        <button className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={onLike}>
          {ui.liked ? '좋아요 취소' : '좋아요'} ({ui.likeCount})
        </button>

        <button className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={onBookmark}>
          {ui.bookmarked ? '북마크 취소' : '북마크'}
        </button>

        <button className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={onRate5}>
          별점 5주기(테스트)
        </button>
      </div>

      {/* 디버깅용: 현재 store.detail 구조 확인 */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600">store.detail 전체 보기 (디버깅)</summary>
        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </details>
    </div>
  );
}