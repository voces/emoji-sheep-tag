import { styled } from "styled-components";
import { useState } from "react";
import { colors } from "@/shared/data.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { playerEntities } from "@/shared/api/player.ts";

const Wrapper = styled.div`
  width: 1cap;
  height: 1cap;
  border: 0;
  padding: 0;
  font-size: inherit;
  position: relative;

  &.hover {
    box-shadow: ${({ theme }) => theme.shadow.sm};
  }
`;

export const PickerCard = styled.div`
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  padding: ${({ theme }) => theme.space[3]};
`;

const Swatch = styled.button<{
  $color: string;
  $selected: boolean;
  $taken: boolean;
}>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid ${({ $selected, theme }) =>
    $selected
      ? `color-mix(in oklab, ${theme.ink.hi} 90%, transparent)`
      : "transparent"};
  background-color: ${({ $color }) => $color};
  cursor: ${({ $taken }) => ($taken ? "not-allowed" : "pointer")};
  opacity: ${({ $taken }) => ($taken ? 0.25 : 1)};
  transition:
    transform ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
  position: relative;
  padding: 0;
  outline: none;
  box-shadow: ${({ $selected }) =>
    $selected
      ? `0 0 0 1px rgba(0, 0, 0, 0.4)`
      : `inset 0 1px 2px rgba(0, 0, 0, 0.2)`};

  ${({ $taken, theme }) =>
    !$taken &&
    `
    &.hover {
      transform: scale(1.15);
      border-color: color-mix(in oklab, ${theme.ink.hi} 50%, transparent);
    }
  `};
`;

export const ColorPickerPopup = (
  { value, onChange, onClose }: {
    value: string;
    onChange: (newValue: string) => void;
    onClose?: () => void;
  },
) => {
  const players = usePlayers();
  useListenToEntities(playerEntities(), ["playerColor"]);
  const takenColors = new Set(players.map((p) => p.playerColor));

  return (
    <PickerCard onClick={(e) => e.stopPropagation()}>
      {colors.map((c) => {
        const isTaken = takenColors.has(c) && c !== value;
        return (
          <Swatch
            key={c}
            $color={c}
            $selected={c === value}
            $taken={isTaken}
            onClick={() => {
              if (!isTaken) {
                onChange(c);
                onClose?.();
              }
            }}
          />
        );
      })}
    </PickerCard>
  );
};

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
        <div style={{ position: "absolute", top: 28, zIndex: 1 }}>
          <ColorPickerPopup
            value={value}
            onChange={onChange}
            onClose={() => setVisible(false)}
          />
        </div>
      )}
    </div>
  );
};
