import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorVar } from "@/vars/editor.ts";
import { Minimap } from "@/components/Minimap/index.tsx";
import { ActionBar } from "./ActionBar.tsx";
import { SlotBar } from "./SlotBar.tsx";
import { PrimaryPortrait } from "./PrimaryPortrait.tsx";
import { SelectionPreview } from "./SelectionPreview.tsx";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { useSlotBarVisible } from "./useSlotBarVisible.ts";

// Minimap panel: 180 + 2*4pad + 2*1border = 190
// Selected panel: 92portrait + 134stats + 8gap + 2*8pad + 2*1border = 252
// Action panel overhead: 2*4pad + 2*1border = 10
// Action cell: 44px, gap: 3px → action grid = 44*N + 3*(N-1) = 47N - 3
// Panel gaps: 8px each
// Slot panel: 44*2 + 3 + 10 = 101
const FIXED_WIDTH = 190 + 8 + 252 + 8 + 10 + 8; // everything except action cells and slots

const Wrapper = styled.div<{
  $preferredActionsPerRow: number;
  $slotOffset: number;
}>`
  position: absolute;
  bottom: ${({ theme }) => theme.space[2]};
  --preferredWidth: ${({ $preferredActionsPerRow, $slotOffset }) =>
    `${FIXED_WIDTH + 47 * $preferredActionsPerRow - 3 + $slotOffset}px`};
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
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-end;
  pointer-events: none;

  &:empty {
    display: none;
  }
`;

const HudPanel = styled.div`
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.space[1]};
  box-shadow: ${({ theme }) => theme.shadow.md};
  pointer-events: auto;
`;

const SelectedPanel = styled(HudPanel)`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
`;

export const BottomBar = () => {
  const editor = useReactiveVar(editorVar);
  const { preferredActionsPerRow } = useReactiveVar(uiSettingsVar);
  const slotBarVisible = useSlotBarVisible();

  return (
    <Wrapper
      $preferredActionsPerRow={preferredActionsPerRow}
      $slotOffset={slotBarVisible ? 101 + 8 : 0}
    >
      {!editor && (
        <HudPanel>
          <Minimap style={{ width: 180 }} />
        </HudPanel>
      )}

      <SelectedPanel>
        <PrimaryPortrait />
        <SelectionPreview />
      </SelectedPanel>

      <HudPanel>
        <ActionBar />
      </HudPanel>

      {slotBarVisible && (
        <HudPanel>
          <SlotBar />
        </HudPanel>
      )}
    </Wrapper>
  );
};
