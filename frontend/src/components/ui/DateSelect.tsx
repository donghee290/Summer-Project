import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DateSelectProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
}

export default function DateSelect({ value, onChange }: DateSelectProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value || null);

  const handleChange = (date: Date | null) => {
    setSelectedDate(date);
    if (onChange) onChange(date);
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="yyyy-MM-dd"
      placeholderText="날짜 선택"
    />
  );
}