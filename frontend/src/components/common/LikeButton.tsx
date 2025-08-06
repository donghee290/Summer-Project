import React from "react";
import { FaHeart } from "react-icons/fa";
import { IconBaseProps } from "react-icons";

interface HeartProps {
  count?: number;
  filled?: boolean;
  size?: number;
  color?: string;
}

export default function LikeButton({ filled = false, size, color }: HeartProps) {
  return React.createElement(FaHeart as React.FC<IconBaseProps>, {
    size,
    color,
    style: {
      cursor: "pointer"
    }
  });
}