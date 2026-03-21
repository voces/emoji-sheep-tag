import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorVar } from "@/vars/editor.ts";
import { CommandButton } from "@/components/Command.tsx";
import { Minimap } from "@/components/Minimap/index.tsx";
import { ActionBar } from "./ActionBar.tsx";
import { SlotBar } from "./SlotBar.tsx";
import { PrimaryPortrait } from "./PrimaryPortrait.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { SelectionPreview } from "./SelectionPreview.tsx";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { useSlotBarVisible } from "./useSlotBarVisible.ts";

const Wrapper = styled(Card)<
  { $preferredActionsPerRow: number; $slotOffset: number }
>`
  position: absolute;
  bottom: 0;
  --preferredWidth: ${({ $preferredActionsPerRow, $slotOffset }) =>
    `calc((506px + ${
      $preferredActionsPerRow ? 8 : 0
    }px + 64px * ${$preferredActionsPerRow} + 4px * ${
      Math.max($preferredActionsPerRow - 1, 0)
    } + ${$slotOffset}px))`};
  left: calc(50% - var(--preferredWidth) / 2);
  transform: translateX(
    min(
      0px,
      max(
        calc(-50% + var(--preferredWidth) / 2),
        calc(100vw - 100% - 50vw + var(--preferredWidth) / 2)
      )
    )
  );
  padding: 12px 12px 8px;

  display: flex;
  gap: 8px;

  &:empty {
    display: none;
  }
`;

const MinimapContainer = styled(CommandButton)`
  width: 200px;
  height: 200px;
`;

export const BottomBar = () => {
  const editor = useReactiveVar(editorVar);
  const { preferredActionsPerRow } = useReactiveVar(uiSettingsVar);
  const slotBarVisible = useSlotBarVisible();

  return (
    <Wrapper
      $preferredActionsPerRow={preferredActionsPerRow}
      $slotOffset={slotBarVisible ? 140 : 0}
    >
      {!editor && (
        <MinimapContainer role="button">
          <Minimap style={{ width: 192, height: 192 }} />
        </MinimapContainer>
      )}

      <PrimaryPortrait />

      <SelectionPreview />

      <ActionBar />

      <SlotBar />
    </Wrapper>
  );
};
