import React from "react";
import StarRate from "./StarRate";
import LikeButton from "./LikeButton";

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
            <>
              <StarRate count={Math.round(rating)} />
              <span>{rating.toFixed(1)}</span>
            </>
          )}
          {likes !== undefined && (
            <LikeButton count={likes} />
          )}
        </div>
      </div>
    </div>
  );
}