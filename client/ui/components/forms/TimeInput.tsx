import React, { useEffect, useState } from "react";
import { MonoInput } from "./TextInput.tsx";

type TimeInputProps = {
  value: number;
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
};

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const parseTime = (input: string): number | null => {
  const cleaned = input.replace(/[^0-9:]/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return minutes * 60 + seconds;
  }

  const n = parseInt(cleaned);
  return isNaN(n) ? null : n;
};

export const TimeInput = ({
  value,
  onChange,
  min = 0,
  max = 9999,
  ...rest
}:
  & TimeInputProps
  & Omit<React.ComponentProps<typeof MonoInput>, "onChange">) => {
  const [display, setDisplay] = useState(formatTime(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDisplay(formatTime(value));
  }, [value, editing]);

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseTime(display);
    if (parsed !== null) {
      const clamped = Math.max(min, Math.min(max, parsed));
      if (clamped !== value) onChange(clamped);
      setDisplay(formatTime(clamped));
    } else {
      setDisplay(formatTime(value));
    }
  };

  return (
    <MonoInput
      type="text"
      value={display}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setDisplay(e.target.value.replace(/[^0-9:]/g, ""))}
      onBlur={handleBlur}
      onFocus={() => setEditing(true)}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder="M:SS"
      {...rest}
    />
  );
};
