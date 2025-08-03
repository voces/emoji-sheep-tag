import { styled } from "npm:styled-components";
//@deno-types="npm:@types/react"
import { useState } from "react";
import { setStoredPlayerName } from "../../util/playerPrefs.ts";

const InputWrapper = styled.div({
  position: "relative",
});

const NameDisplay = styled.span<{ $readonly?: boolean }>((
  { $readonly },
) => ({
  textDecoration: $readonly ? "none" : "underline",
  "&.hover": {
    textShadow: $readonly
      ? undefined
      : "0 0 2px var(--color-border), 0 0 4px var(--color-border), 0 0 4px var(--color-border)",
  },
}));

const NameInputField = styled.input({ width: "100%" });

export const NameInput = (
  { value, onChange, readonly }: {
    value: string;
    onChange: (newValue: string) => void;
    readonly?: boolean;
  },
) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

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
          maxLength={20}
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
};
