import { styled } from "styled-components";
import { forwardRef, useImperativeHandle, useState } from "react";
import { setStoredPlayerName } from "../../../util/playerPrefs.ts";
import { useMemoState } from "@/hooks/useMemoState.ts";

const InputWrapper = styled.div`
  position: relative;
`;

const NameDisplay = styled.span<{ $readonly?: boolean }>`
  display: inline-block;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.xs};
  padding: 0;
  margin: 0;
  line-height: normal;
  filter: ${(
    { $readonly, theme },
  ) =>
    $readonly
      ? undefined
      : `drop-shadow(0 0 2px color-mix(in oklab, ${theme.ink.hi} 40%, transparent))`};

  &.hover {
    filter: ${(
      { $readonly, theme },
    ) =>
      $readonly
        ? undefined
        : `drop-shadow(0 0 2px color-mix(in oklab, ${theme.ink.hi} 85%, transparent))`};
  }
`;

const NameInputField = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  border-radius: ${({ theme }) => theme.radius.xs};
  padding: 0;
  margin: 0;
  line-height: normal;
`;

export type NameInputRef = {
  startEditing: () => void;
};

export const NameInput = forwardRef<
  NameInputRef,
  {
    value: string;
    onChange: (newValue: string) => void;
    readonly?: boolean;
  }
>(({ value, onChange, readonly }, ref) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useMemoState(value);

  useImperativeHandle(ref, () => ({
    startEditing: () => {
      if (!readonly) {
        setEditing(true);
      }
    },
  }));

  const handleSubmit = () => {
    if (tempValue.trim() && tempValue !== value) {
      const newName = tempValue.trim();
      onChange(newName);
      setStoredPlayerName(newName);
    }
    setEditing(false);
    setTempValue(value);
  };

  const handleCancel = () => {
    setEditing(false);
    setTempValue(value);
  };

  if (editing && !readonly) {
    return (
      <InputWrapper>
        <NameInputField
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          maxLength={16}
        />
      </InputWrapper>
    );
  }

  return (
    <InputWrapper>
      <NameDisplay
        $readonly={readonly}
        onClick={() => !readonly && setEditing(true)}
      >
        {value}
      </NameDisplay>
    </InputWrapper>
  );
});
