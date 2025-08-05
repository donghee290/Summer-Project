import React from "react";
import { FaHeart } from "react-icons/fa";
import { IconBaseProps } from "react-icons";

interface HeartProps {
  filled?: boolean;
  size?: number;
  color?: string;
}

export default function Heart({ filled = false, size = 16, color = "red" }: HeartProps) {
  return React.createElement(FaHeart as React.FC<IconBaseProps>, {
    size,
    color,
    style: {
      cursor: "pointer"
    }
  });
}