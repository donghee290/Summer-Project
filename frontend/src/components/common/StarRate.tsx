import React from "react";
import { FaStar } from 'react-icons/fa';
import { IconBaseProps } from "react-icons";

interface StarRatingProps {
  count?: number;
  size?: number; 
  color?: string;
}

export function StarRating({ count = 0, size, color }: StarRatingProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      {Array.from({ length: count }, (_, idx) => (
        React.createElement(FaStar as React.FC<IconBaseProps>, {
          key: idx,
          size,
          color
        })
      ))}
    </div>
  );
}