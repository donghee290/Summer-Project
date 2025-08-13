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
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        cursor: "pointer",
        borderBottom: "1px solid #ddd",
        padding: "16px 0",
      }}
    >
      {/* 썸네일 */}
      <div style={{ width: "120px", height: "80px", flexShrink: 0 }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "#888",
              borderRadius: "4px"
            }}
          >
            이미지 없음
          </div>
        )}
      </div>

      {/* 텍스트 영역 */}
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "bold" }}>{title}</h3>

        <div style={{ marginBottom: "4px", fontSize: "14px", color: "#666" }}>
          <span style={{ marginRight: "8px" }}>{category}</span>
          <span>{date}</span>
        </div>

        <p style={{ margin: "8px 0", fontSize: "15px", color: "#333" }}>{summary}</p>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {rating !== undefined && <span>{rating}</span>}
          {likes !== undefined && <LikeButton count={likes} />}
        </div>
      </div>
    </div>
  );
}