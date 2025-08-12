// src/pages/article/ArticleDetailPage.tsx
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useArticleStore } from '../../store/articleStore';

// detail 응답이 납작/중첩 두 형태로 올 수 있어 로컬 타입을 느슨하게 합쳐서 처리
type DetailNested = {
  article?: {
    article_no?: number;
    article_title?: string;
    article_press?: string;
    article_reg_at?: string;
    article_content?: string;
    article_like_count?: number;
  };
  userInteractions?: {
    liked?: boolean;
    bookmarked?: boolean;
  };
};

type DetailFlat = {
  article_no?: number;
  article_title?: string;
  article_press?: string;
  article_reg_at?: string;
  article_content?: string;
  article_like_count?: number;
  liked?: boolean;
  bookmarked?: boolean;
  likeCount?: number;
};

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const routeId = Number(id);

  const { detail, loading, error, loadDetail, toggleLike, toggleBookmark, rate } =
    useArticleStore();

  useEffect(() => {
    if (!Number.isNaN(routeId)) loadDetail(routeId);
  }, [routeId, loadDetail]);

  // detail을 납작/중첩 케이스 모두 커버하도록 느슨하게 캐스팅
  const d = (detail ?? null) as (Partial<DetailNested & DetailFlat>) | null;

  // URL 파라미터가 숫자가 아니면 detail 안에서 id 추출
  const articleId = useMemo(
    () => (Number.isNaN(routeId) ? (d?.article?.article_no ?? d?.article_no) : routeId),
    [routeId, d?.article?.article_no, d?.article_no],
  );

  // 화면에 바로 쓸 수 있게 파생값 구성
  const title = d?.article_title ?? d?.article?.article_title ?? '';
  const press = d?.article_press ?? d?.article?.article_press ?? '';
  const regAt = d?.article_reg_at ?? d?.article?.article_reg_at ?? '';
  const content = d?.article_content ?? d?.article?.article_content ?? '';
  const likeCount = d?.likeCount ?? d?.article_like_count ?? 0;
  const liked = !!(d?.liked ?? d?.userInteractions?.liked);
  const bookmarked = !!(d?.bookmarked ?? d?.userInteractions?.bookmarked);

  if (loading || !d) return <div>로딩 중…</div>;
  if (error) return <div>에러: {error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>{title}</h1>
      <div style={{ color: '#666' }}>
        {press} · {regAt ? new Date(regAt).toLocaleString() : ''}
      </div>
      <p style={{ whiteSpace: 'pre-line', marginTop: 12 }}>{content}</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => articleId && toggleLike(articleId)}>
          {liked ? '좋아요 취소' : '좋아요'} ({likeCount})
        </button>

        <button onClick={() => articleId && toggleBookmark(articleId)}>
          {bookmarked ? '북마크 취소' : '북마크'}
        </button>

        <button onClick={() => articleId && rate(articleId, 5)}>별점 5주기(테스트)</button>
      </div>
    </div>
  );
}