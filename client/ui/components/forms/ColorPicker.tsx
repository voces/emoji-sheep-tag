import { styled } from "styled-components";
import { useState } from "react";
import { colors } from "@/shared/data.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { playersVar } from "@/vars/players.ts";

const Wrapper = styled.div`
  width: 1cap;
  height: 1cap;
  border: 0;
  padding: 0;
  font-size: inherit;
  position: relative;

  &.hover,
  &:hover {
    box-shadow: ${({ theme }) => theme.colors.shadow} ${({ theme }) =>
      theme.shadows.sm};
  }
`;

const PickerCard = styled.div`
  position: absolute;
  background: ${({ theme }) => theme.colors.body};
  border: 1px solid ${({ theme }) => theme.colors.border};
  top: 28px;
  box-shadow: ${({ theme }) => theme.colors.shadow} ${({ theme }) =>
    theme.shadows.md};
  display: grid;
  grid-template-columns: repeat(6, 2cap);
  grid-template-rows: repeat(4, 2cap);
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  z-index: 1;
`;

const Color = styled.span<
  { $color: string; $selected: boolean; $disabled: boolean }
>`
  background-color: ${({ $color }) => $color};
  border: 1px solid ${({ $disabled, theme }) =>
    $disabled ? "transparent" : theme.colors.border};
  box-shadow: ${({ $selected, theme }) =>
    $selected ? `${theme.colors.shadow} 1px 1px` : "none"};

  &.hover {
    box-shadow: ${({ theme, $disabled }) =>
      $disabled ? "none" : `${theme.colors.border} 1px 1px`};
  }
`;

export const ColorPicker = (
  { value, onChange, readonly }: {
    value: string;
    onChange: (newValue: string) => void;
    readonly?: boolean;
  },
) => {
  const [visible, setVisible] = useState(false);
  const players = useReactiveVar(playersVar);
  const takenColors = new Set(players.map((p) => p.color));

  return (
    <div style={{ position: "relative" }}>
      <Wrapper
        style={{ background: value }}
        onClick={() => !readonly && setVisible((v) => !v)}
      />
      {visible && (
        <PickerCard onClick={(e) => e.stopPropagation()}>
          {colors.map((c) => {
            const isTaken = takenColors.has(c) && c !== value;
            return (
              <Color
                key={c}
                $color={c}
                $selected={c === value}
                $disabled={isTaken}
                onClick={() => {
                  if (!isTaken) {
                    onChange(c);
                    setVisible(false);
                  }
                }}
              />
            );
          })}
        </PickerCard>
      )}
    </div>
  );
};
