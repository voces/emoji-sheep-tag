import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { styled } from "styled-components";
import { app, Entity } from "../../../../ecs.ts";
import { selection } from "../../../../systems/selection.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import {
  closeMenusForUnit,
  getCurrentMenu,
  menuStateVar,
} from "@/vars/menuState.ts";
import { useMemo } from "react";
import { Action } from "@/components/game/Action.tsx";
import { applyShortcutOverride } from "../../../../util/applyShortcutOverrides.ts";
import { getExecutableActions } from "../../../../util/allyPermissions.ts";
import { menusVar } from "@/vars/menus.ts";
import {
  actionToShortcutKey,
  menuActionRefToKey,
} from "../../../../util/actionToShortcutKey.ts";
import { convertMenuConfigToAction } from "../../../../util/convertMenuConfigToAction.ts";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { Command } from "@/components/game/Command.tsx";

const Row = styled(HStack)<{ $preferredActionsPerRow: number }>`
  flex: 1;
  min-width: ${({ $preferredActionsPerRow }) =>
    `calc(64px * ${$preferredActionsPerRow} + 4px * ${
      Math.max($preferredActionsPerRow - 1, 0)
    })`};
`;

export const selectionVar = makeVar<Entity | undefined>(undefined);
selection.addEventListener(
  "add",
  (e) => selectionVar((v) => v?.selected && app.entities.has(v) ? v : e),
);
selection.addEventListener(
  "delete",
  (e) => {
    closeMenusForUnit(e.id);
    selectionVar((v) =>
      v !== e && v?.selected && app.entities.has(v) ? v : selection.first()
    );
  },
);

const rowKeys = [
  "QWERTYUIOP",
  "ASDFGHJKL",
  "ZXCVBNM",
].map((r) => r.split("").map((l) => `Key${l}`));
rowKeys[2].push("Backquote");
export const actionsToRows = (
  actions: UnitDataAction[],
  preferredActionsPerRow: number,
) => {
  const rows: (UnitDataAction | undefined)[][] = [[], [], []];
  const extra: UnitDataAction[] = [];
  const extraActionsSet = new Set<UnitDataAction>();

  outer: for (const a of actions) {
    if (!a.binding || !a.binding.length) {
      extra.push(a);
      extraActionsSet.add(a);
      continue;
    }
    for (let y = 0; y < rowKeys.length; y++) {
      const row = rowKeys[y];
      for (let x = 0; x < row.length; x++) {
        if (a.binding.includes(row[x])) {
          if (!rows[y][x]) {
            rows[y][x] = a;
          } else {
            x = row.length;
            while (rows[y][x]) x++;
            rows[y][x] = a;
          }
          continue outer;
        }
      }
    }
    extra.push(a);
    extraActionsSet.add(a);
  }

  outer: for (const a of extra) {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0;; x++) {
        if (!rows[y][x]) {
          rows[y][x] = a;
          continue outer;
        }
      }
    }
  }

  const padRows = (
    rows: (UnitDataAction | undefined)[][],
    targetWidth: number,
  ) => {
    return rows.map((row) => {
      const padded = [...row];
      while (padded.length < targetWidth) {
        padded.push(undefined);
      }
      return padded;
    });
  };

  const filledRows = rows.map((r) =>
    Array.from({ length: r.length }, (_, i) => r[i])
  );

  const columns = Math.max(
    Math.ceil(actions.length / filledRows.length),
    preferredActionsPerRow,
  );
  if (filledRows.every((r) => r.length <= columns)) {
    return padRows(filledRows, columns);
  }

  const balancedRows = rows.map((r) =>
    Array.from({ length: r.length }, (_, i) => r[i])
  );

  // Skip compaction if columns 11 (Unlimited)
  if (columns === 11) {
    const maxLength = Math.max(...balancedRows.map((r) => r.length));
    return padRows(balancedRows, maxLength);
  }

  // Compact rows to reach columns
  for (let y = 0; y < balancedRows.length; y++) {
    const row = balancedRows[y];

    // First priority: compact holes within the row (right to left)
    while (row.length > columns) {
      // Find the rightmost hole
      let holeIndex = -1;
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] === undefined) {
          holeIndex = x;
          break;
        }
      }

      if (holeIndex === -1) break; // No holes found

      // Shift items after the hole to fill it in
      row.splice(holeIndex, 1);
    }

    // Second priority: shift items to other rows
    while (row.length > columns) {
      // Find another row with space, preferring nearby rows
      // Try rows in order of distance: y-1, y+1, y-2, y+2, etc.
      let targetRow = -1;
      const distances = [1, -1, 2, -2]; // Prefer nearby rows
      for (const dist of distances) {
        const otherY = y + dist;
        if (otherY < 0 || otherY >= balancedRows.length) continue;

        const otherRow = balancedRows[otherY];

        // Check if this row can accept an item without exceeding columns
        // Count non-undefined items to see actual length
        const actualLength = otherRow.filter((item) => item !== undefined)
          .length;
        const hasHole = otherRow.some((item) => item === undefined);

        // Can accept if it has a hole (won't grow) or if it's under the limit
        if (hasHole || actualLength < columns) {
          targetRow = otherY;
          break;
        }
      }

      if (targetRow === -1) break; // No space in nearby rows

      // Find the rightmost extra (unbound) action to move first, otherwise use last item
      let itemToMove: UnitDataAction | undefined;
      let removeIndex = -1;

      // Search from right to left for an extra action
      for (let x = row.length - 1; x >= 0; x--) {
        const item = row[x];
        if (item !== undefined && extraActionsSet.has(item)) {
          itemToMove = item;
          removeIndex = x;
          break;
        }
      }

      // If no extra action found, use the last non-undefined item
      if (itemToMove === undefined) {
        for (let x = row.length - 1; x >= 0; x--) {
          if (row[x] !== undefined) {
            itemToMove = row[x];
            removeIndex = x;
            break;
          }
        }
      }

      // If still nothing to move (all undefined), just pop
      if (itemToMove === undefined) {
        row.pop();
        continue;
      }

      // Remove the item
      row.splice(removeIndex, 1);

      // Find first hole in target row, or append if no hole
      const targetRowArray = balancedRows[targetRow];
      const holeIndex = targetRowArray.findIndex((item) => item === undefined);
      if (holeIndex !== -1) {
        targetRowArray[holeIndex] = itemToMove;
      } else {
        targetRowArray.push(itemToMove);
      }
    }
  }

  return padRows(balancedRows, columns);
};

export const ActionBar = () => {
  const selection = useReactiveVar(selectionVar);
  const shortcuts = useReactiveVar(shortcutsVar);
  const menus = useReactiveVar(menusVar);
  useReactiveVar(menuStateVar);
  const currentMenu = getCurrentMenu();
  useListenToEntityProps(selection, ["order", "actions", "inventory", "owner"]);
  const localPlayer = useLocalPlayer();
  const { preferredActionsPerRow } = useReactiveVar(uiSettingsVar);

  // Show menu actions if menu is active
  let displayActions: ReadonlyArray<
    React.ComponentProps<typeof Action>["action"]
  > = currentMenu ? currentMenu.action.actions : selection?.actions ?? [];

  // Get actions that are referenced by menus for this prefab
  const actionsInMenus = new Set<string>();
  if (!currentMenu && selection?.prefab) {
    const prefabMenus = menus.filter((menu) =>
      menu.prefabs.includes(selection.prefab!)
    );
    for (const menu of prefabMenus) {
      for (const action of menu.actions) {
        // Skip nested menu configs (they don't represent individual actions to filter)
        if ("type" in action) {
          actionsInMenus.add(menuActionRefToKey(action));
        }
      }
    }
  }

  // Filter out actions that are in menus
  if (!currentMenu && actionsInMenus.size > 0) {
    displayActions = displayActions.filter((action) =>
      !actionsInMenus.has(actionToShortcutKey(action))
    );
  }

  // Add configured menu actions for this prefab
  if (!currentMenu && selection?.prefab) {
    const menuActions = menus
      .filter((menu) => menu.prefabs.includes(selection.prefab!))
      .map((menu) =>
        convertMenuConfigToAction(menu, menus, shortcuts, selection)
      )
      .filter((menu) => {
        // Filter out menus that only have a back action (or are empty)
        const nonBackActions = menu.actions.filter((a) =>
          a.type !== "auto" || a.order !== "back"
        );
        return nonBackActions.length > 0;
      });
    displayActions = [...displayActions, ...menuActions];
  }

  // Add item actions from inventory and apply shortcut overrides
  if (!currentMenu && selection?.inventory && !selection.isMirror) {
    const itemActions: (typeof displayActions)[number][] = [];
    for (const item of selection.inventory) {
      if (item.actions && (item.charges == null || item.charges > 0)) {
        for (const itemAction of item.actions) {
          // Create an action with the charge count in the name if applicable
          let actionWithCharges = {
            ...itemAction,
            count: item.charges,
          };

          // Apply shortcut overrides if the selection has a prefab
          if (selection.prefab) {
            actionWithCharges = applyShortcutOverride(
              actionWithCharges,
              shortcuts,
              selection.prefab,
            );
          }

          itemActions.push(actionWithCharges);
        }
      }
    }
    displayActions = [...displayActions, ...itemActions];
  }

  const currentActionCheck = useMemo(
    () => (action: UnitDataAction) => {
      if (!selection) return false;

      switch (action.type) {
        case "build":
          return selection.order?.type === "build" &&
            selection.order.unitType === action.unitType;

        case "auto":
          if (selection.order?.type === "cast") {
            return action.order === selection.order.orderId;
          }
          if (selection.order?.type === "hold") return action.order === "hold";
          if (!selection.order) return action.order === "stop";
          return false;

        case "target":
          // Special cases for attack and move
          if (action.order === "attack") {
            return selection.order?.type === "attack" ||
              selection.order?.type === "attackMove";
          }
          if (action.order === "move") {
            return !!selection.order && "path" in selection.order;
          }
          // Generic target actions (sentry, meteor, save, etc.)
          return selection.order?.type === "cast" &&
            selection.order.orderId === action.order;

        case "purchase":
          return false; // Purchase actions are instant, never current

        case "menu":
          return !!(currentMenu && currentMenu.action === action);

        default:
          return false;
      }
    },
    [selection, currentMenu],
  );

  // Filter actions based on ownership and ally permissions
  const executableActions = selection && localPlayer
    ? getExecutableActions(
      localPlayer.id,
      selection,
      displayActions,
    )
    : [];

  const rows = actionsToRows(executableActions, preferredActionsPerRow);

  return (
    <VStack role="toolbar" $gap="sm">
      {rows.map((r, y) => (
        <Row
          key={y}
          $gap="sm"
          $preferredActionsPerRow={Math.min(preferredActionsPerRow, 10)}
        >
          {r.map((action, x) =>
            action && selection
              ? (
                <Action
                  key={`${selection.id}-${action.type}-${action.name}`}
                  action={action}
                  entity={selection}
                  current={currentActionCheck(action)}
                />
              )
              : <Command key={`${selection?.id}-${y}-${x}`} name="" disabled />
          )}
        </Row>
      ))}
    </VStack>
  );
};
