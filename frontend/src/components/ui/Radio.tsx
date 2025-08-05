import React from "react";

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Radio({ label, ...props }: RadioProps) {
  return (
    <label>
      <input type="radio" {...props} />
      {label}
    </label>
  );
}