// src/components/common/BookmarkButton.tsx
import React from 'react';
import { useArticleStore } from '../../store/articleStore';

export type BookmarkButtonProps = {
  /** 기본은 현재 상세의 article_no 사용. 특정 기사에 대해 강제로 토글하려면 넘겨주세요 */
  articleId?: number;
  className?: string;
  /** 접근성/텍스트 커스터마이즈 */
  labelOn?: string;   // 북마크됨일 때
  labelOff?: string;  // 북마크 아님일 때
};

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  articleId,
  className,
  labelOn = '북마크됨',
  labelOff = '북마크',
}) => {
  const { detail, loading, toggleBookmark } = useArticleStore();

  // 상세 페이지 기준: 전달된 articleId 없으면 현재 상세의 article_no 사용
type DetailShapeA = {
  article?: { article_no?: number };
  userInteractions?: { bookmarked?: boolean };
};
type DetailShapeB = {
  article_no?: number;
  bookmarked?: boolean;
};

const d = (detail ?? null) as (Partial<DetailShapeA & DetailShapeB>) | null;

const targetId = articleId ?? d?.article?.article_no ?? d?.article_no;
const isBookmarked = !!(d?.userInteractions?.bookmarked ?? d?.bookmarked);

  const handleClick = async () => {
    if (!targetId) return; // 아직 상세 로딩 전 등
    await toggleBookmark(targetId);
  };

  const icon = isBookmarked ? '★' : '☆';
  const label = isBookmarked ? labelOn : labelOff;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!targetId || loading}
      aria-pressed={isBookmarked}
      title={label}
      className={className}
    >
      {icon} {label}
    </button>
  );
};
