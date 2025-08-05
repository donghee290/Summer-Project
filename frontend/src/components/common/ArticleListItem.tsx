import React from "react";

export interface ArticleListItemProps {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  thumbnailUrl?: string;
  press?: string;
  author?: string;
  rating?: number;
  likes?: number;
  onClick?: (id: string) => void;
}

export default function ArticleListItem({
  id,
  title,
  summary,
  category,
  date,
  thumbnailUrl,
  rating,
  likes,
  onClick
}: ArticleListItemProps) {
  const handleClick = () => {
    if (onClick) onClick(id);
  };

  return (
    <div onClick={handleClick} style={{ cursor: "pointer" }}>
      <div>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} />
        ) : (
          <div>이미지</div>
        )}
      </div>

      <div>
        <h3>{title}</h3>
        <div>
          <span>{category}</span>
          <span>{date}</span>
        </div>
        <p>{summary}</p>
        <div>
          {rating !== undefined && (
            <span>별점 {rating.toFixed(1)}</span>
          )}
          {likes !== undefined && (
            <span>좋아요 {likes}</span>
          )}
        </div>
      </div>
    </div>
  );
}