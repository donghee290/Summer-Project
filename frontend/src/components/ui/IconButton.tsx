import React from "react";
import { IconType, IconBaseProps } from "react-icons";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconType;
  size?: number;
  color?: string;
}

export default function IconButton({ icon: Icon, size, color, ...props }: IconButtonProps) {
  return (
    <button {...props}>
      {React.createElement(Icon as React.FC<IconBaseProps>, { size, color })}
    </button>
  );
}