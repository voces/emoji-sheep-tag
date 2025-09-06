import React, { useEffect, useState } from "react";
import { styled } from "npm:styled-components";
import { Input } from "./Input.tsx";

const StyledTimeInput = styled(Input)`
  font-family: monospace;
`;

type TimeInputProps = {
  value: number; // Value in seconds
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
};

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
};

const parseTime = (timeString: string): number | null => {
  // Remove any non-digit characters except colon
  const cleaned = timeString.replace(/[^\d:]/g, "");

  // Handle various formats
  if (cleaned.includes(":")) {
    const [minutesPart, secondsPart] = cleaned.split(":");
    const minutes = parseInt(minutesPart) || 0;
    const seconds = parseInt(secondsPart) || 0;

    // Validate seconds part (should be 0-59)
    if (seconds >= 60) return null;

    return minutes * 60 + seconds;
  } else {
    // If no colon, treat as total seconds
    const totalSeconds = parseInt(cleaned);
    return isNaN(totalSeconds) ? null : totalSeconds;
  }
};

export const TimeInput = ({
  value,
  onChange,
  min = 0,
  max = 9999,
  ...rest
}: TimeInputProps & Omit<React.ComponentProps<typeof Input>, "onChange">) => {
  const [displayValue, setDisplayValue] = useState(formatTime(value));
  const [isEditing, setIsEditing] = useState(false);

  // Update display when external value changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatTime(value));
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
  };

  const handleBlur = () => {
    setIsEditing(false);

    const parsed = parseTime(displayValue);
    if (parsed !== null) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setDisplayValue(formatTime(clamped));
    } else {
      // Reset to current value if parse failed
      setDisplayValue(formatTime(value));
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <StyledTimeInput
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder="MM:SS"
      {...rest}
    />
  );
};
