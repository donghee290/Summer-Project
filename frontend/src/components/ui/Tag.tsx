import React from "react";

interface TagProps {
  label: string;
  onRemove?: () => void;
}

export default function Tag({ label, onRemove }: TagProps) {
  return (
    <span>
      {label}
      {onRemove && (
        <button onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}