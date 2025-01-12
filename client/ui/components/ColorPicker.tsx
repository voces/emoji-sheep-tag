import { styled } from "npm:styled-components";
//@deno-types="npm:@types/react"
import React, { useState } from "react";
import { colors } from "../../../shared/data.ts";

const Wrapper = styled.button(({ theme }) => ({
  width: "1cap",
  height: "1cap",
  border: 0,
  padding: 0,
  fontSize: "inherit",
  position: "relative",
  "&.hover": {
    border: "1px solid black",
    boxShadow: "black 1px 1px",
  },
}));

const PickerCard = styled.div({
  position: "absolute",
  background: "white",
  top: 20,
  boxShadow: "black 1px 1px 3px",
  display: "grid",
  gridTemplateColumns: "repeat(6, 2cap)",
  gridTemplateRows: "repeat(4, 2cap)",
  gap: 4,
  padding: 4,
});

const Color = styled.span<{ color: string; selected: boolean }>((
  { color, selected },
) => ({
  backgroundColor: color,
  border: selected ? "1px solid black" : undefined,
  "&.hover": {
    border: "1px solid black",
    boxShadow: "black 1px 1px",
  },
}));

export const ColorPicker = (
  { value, onChange }: { value: string; onChange: (newValue: string) => void },
) => {
  const [visible, setVisible] = useState(false);
  return (
    <Wrapper
      style={{ background: value }}
      onClick={() => setVisible((v) => !v)}
    >
      {visible && (
        <PickerCard onClick={(e: Event) => e.stopPropagation()}>
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
    </Wrapper>
  );
};
