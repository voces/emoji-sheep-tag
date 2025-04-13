import { styled } from "npm:styled-components";
//@deno-types="npm:@types/react"
import React, { useState } from "react";
import { colors } from "../../../shared/data.ts";

const Wrapper = styled.div(({ theme }) => ({
  width: "1cap",
  height: "1cap",
  border: 0,
  padding: 0,
  fontSize: "inherit",
  position: "relative",
  "&.hover, &:hover": {
    boxShadow: "var(--color-shadow) 1px 1px 1px 2px",
  },
}));

const PickerCard = styled.div({
  position: "absolute",
  background: "var(--color-body)",
  border: "1px solid var(--color-border)",
  top: 28,
  boxShadow: "var(--color-shadow) 1px 1px 3px",
  display: "grid",
  gridTemplateColumns: "repeat(6, 2cap)",
  gridTemplateRows: "repeat(4, 2cap)",
  gap: 4,
  padding: 4,
  zIndex: 1,
});

const Color = styled.span<{ color: string; selected: boolean }>((
  { color, selected },
) => ({
  backgroundColor: color,
  border: "1px solid var(--color-border)",
  boxShadow: selected ? "var(--color-shadow) 1px 1px" : undefined,
  "&.hover": {
    boxShadow: "var(--color-border) 1px 1px",
  },
}));

export const ColorPicker = (
  { value, onChange, readonly }: {
    value: string;
    onChange: (newValue: string) => void;
    readonly?: boolean;
  },
) => {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Wrapper
        style={{ background: value }}
        onClick={() => !readonly && setVisible((v) => !v)}
      />
      {visible && (
        <PickerCard onClick={(e) => e.stopPropagation()}>
          {colors.map((c) => (
            <Color
              key={c}
              color={c}
              selected={c === value}
              onClick={() => {
                onChange(c);
                setVisible(false);
              }}
            />
          ))}
        </PickerCard>
      )}
    </div>
  );
};
