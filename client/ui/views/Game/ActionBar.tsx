import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { styled } from "styled-components";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/autoSelect.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { playersVar, useLocalPlayer } from "@/vars/players.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { useListenToEntityProp } from "@/hooks/useListenToEntityProp.ts";
import {
  closeMenusForUnit,
  getCurrentMenu,
  menuStateVar,
} from "@/vars/menuState.ts";
import { useMemo } from "react";
import { Action } from "@/components/game/Action.tsx";
import { applyShortcutOverride } from "../../../util/applyShortcutOverrides.ts";
import { Card } from "@/components/layout/Card.tsx";
import { getExecutableActions } from "../../../util/allyPermissions.ts";

const ActionBarContainer = styled(Card)`
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  gap: 10px;
  padding: 12px;
  display: flex;

  &:empty {
    display: none;
  }
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

export const ActionBar = () => {
  const selection = useReactiveVar(selectionVar);
  const shortcuts = useReactiveVar(shortcutsVar);
  useReactiveVar(menuStateVar);
  const currentMenu = getCurrentMenu();
  useListenToEntityProp(selection, "order");
  useListenToEntityProp(selection, "mana");
  useListenToEntityProp(selection, "inventory");
  const localPlayer = useLocalPlayer();

  // Listen to gold changes on the owning player's entity
  const owningPlayer = selection
    ? playersVar().find((p) => p.id === selection.owner)
    : undefined;
  useListenToEntityProp(owningPlayer?.entity, "gold");

  // Show menu actions if menu is active
  let displayActions: ReadonlyArray<
    React.ComponentProps<typeof Action>["action"]
  > = currentMenu ? currentMenu.action.actions : selection?.actions ?? [];

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

  if (!selection || !localPlayer) return null;

  // Filter actions based on ownership and ally permissions
  const executableActions = getExecutableActions(
    localPlayer.id,
    selection,
    displayActions,
  );

  if (executableActions.length === 0) return null;

  return (
    <ActionBarContainer role="toolbar">
      {executableActions.map((action) => (
        <Action
          key={`${selection.id}-${action.type}-${action.name}`}
          action={action}
          entity={selection}
          current={currentActionCheck(action)}
        />
      ))}
    </ActionBarContainer>
  );
};
