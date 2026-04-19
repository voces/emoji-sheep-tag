import React, { useEffect, useState } from "react";
import { MonoInput } from "./TextInput.tsx";

type PercentInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

const formatPercent = (decimal: number): string =>
  `${Math.round(decimal * 100)}%`;

const parsePercent = (input: string): number | null => {
  const cleaned = input.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned);
  return isNaN(n) ? null : n / 100;
};

export const PercentInput = ({
  value,
  onChange,
  min = 0,
  max = 10,
  ...rest
}:
  & PercentInputProps
  & Omit<React.ComponentProps<typeof MonoInput>, "onChange">) => {
  const [display, setDisplay] = useState(formatPercent(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDisplay(formatPercent(value));
  }, [value, editing]);

  const handleBlur = () => {
    setEditing(false);
    const parsed = parsePercent(display);
    if (parsed !== null) {
      const clamped = Math.max(min, Math.min(max, parsed));
      if (clamped !== value) onChange(clamped);
      setDisplay(formatPercent(clamped));
    } else {
      setDisplay(formatPercent(value));
    }
  };

  return (
    <MonoInput
      type="text"
      value={display}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setDisplay(e.target.value.replace(/[^0-9%]/g, ""))}
      onBlur={handleBlur}
      onFocus={() => setEditing(true)}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder="100%"
      {...rest}
    />
  );
};
