import { useReactiveVar } from "@/hooks/useVar.tsx";
import { styled } from "styled-components";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { Action } from "@/components/game/Action.tsx";
import { applyShortcutOverride } from "../../../../util/applyShortcutOverrides.ts";
import { Command } from "@/components/game/Command.tsx";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { SLOT_COUNT } from "@/util/shortcutUtils.ts";
import { selectionVar } from "./ActionBar.tsx";
import { useSlotBarVisible } from "./useSlotBarVisible.ts";

const SlotRow = styled(HStack)`
`;

// Slot layout: rows are [7,8], [4,5], [1,2] (matching numpad layout)
const slotRows = [[0, 1], [2, 3], [4, 5]];

export const SlotBar = () => {
  const visible = useSlotBarVisible();
  const selection = useReactiveVar(selectionVar);
  const shortcuts = useReactiveVar(shortcutsVar);

  if (!visible || !selection?.inventory) return null;

  const itemActions: React.ComponentProps<typeof Action>["action"][] = [];
  for (const item of selection.inventory) {
    if (item.actions && (item.charges == null || item.charges > 0)) {
      for (const itemAction of item.actions) {
        let action = { ...itemAction, count: item.charges };
        if (selection.prefab) {
          action = applyShortcutOverride(action, shortcuts, selection.prefab);
        }
        itemActions.push(action);
      }
    }
  }

  if (itemActions.length === 0) return null;

  const prefabShortcuts = selection.prefab
    ? shortcuts[selection.prefab]
    : undefined;

  return (
    <VStack $gap="sm">
      {slotRows.map((row, y) => (
        <SlotRow key={y} $gap="sm">
          {row.map((slotIdx) => {
            const action = itemActions[slotIdx];
            const slotBinding = prefabShortcuts?.[`slot-${slotIdx + 1}`];
            if (action && selection) {
              return (
                <Action
                  key={`slot-${slotIdx}`}
                  action={{
                    ...action,
                    binding: slotBinding,
                  }}
                  entity={selection}
                  current={false}
                />
              );
            }
            return slotIdx < SLOT_COUNT
              ? (
                <Command
                  key={`slot-${slotIdx}`}
                  name=""
                  disabled
                  binding={slotBinding}
                />
              )
              : null;
          })}
        </SlotRow>
      ))}
    </VStack>
  );
};
