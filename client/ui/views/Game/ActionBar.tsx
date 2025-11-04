import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { styled } from "styled-components";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/selection.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { getPlayer } from "@/shared/api/player.ts";
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
import { MenuActionRef, MenuConfig, menusVar } from "@/vars/menus.ts";
import { items, prefabs } from "@/shared/data.ts";
import {
  actionToShortcutKey,
  menuActionRefToKey,
} from "../../../util/actionToShortcutKey.ts";

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

// Helper to convert menu config to UnitDataAction
const convertMenuConfigToAction = (
  config: MenuConfig,
  allConfigs: MenuConfig[],
  shortcuts: Record<string, Record<string, string[]>>,
  section: string,
): UnitDataAction & { type: "menu" } => {
  const convertActionRef = (
    ref: MenuActionRef | MenuConfig,
  ): UnitDataAction => {
    if ("id" in ref) {
      // It's a nested menu config
      return convertMenuConfigToAction(ref, allConfigs, shortcuts, section);
    }
    if (ref.type === "action") {
      // Back action
      if (ref.actionKey === "back") {
        const actionKey = `menu-back-${config.id}`;
        const binding = shortcuts[section]?.[actionKey] ?? ["Backquote"];
        return {
          name: "Back",
          type: "auto",
          order: "back",
          icon: "cancel",
          binding,
        };
      }
      // Look up the action from the prefab
      const prefab = prefabs[section];
      const prefabAction = prefab?.actions?.find((a) =>
        actionToShortcutKey(a) === ref.actionKey
      );
      if (prefabAction) {
        // Get binding from shortcuts (using the action key, not menu-prefixed)
        const binding = shortcuts[section]?.[ref.actionKey] ??
          prefabAction.binding ?? [];
        return {
          ...prefabAction,
          binding,
        };
      }
      // Fallback if action not found
      const actionKey = `menu-${config.id}.${ref.actionKey}`;
      const binding = shortcuts[section]?.[actionKey] ?? [];
      return {
        name: ref.actionKey,
        type: "auto",
        order: ref.actionKey,
        binding,
      };
    }
    // Purchase action
    const item = items[ref.itemId];
    const actionKey = `menu-${config.id}.purchase-${ref.itemId}`;
    const binding = shortcuts[section]?.[actionKey] ?? item.binding;
    return {
      name: `Purchase ${item.name}`,
      description: item.description,
      type: "purchase",
      itemId: ref.itemId,
      binding,
      goldCost: item.gold,
    };
  };

  // Apply shortcut override to menu itself
  const menuBinding = shortcuts[section]?.[`menu-${config.id}`] ??
    config.binding;

  return {
    name: config.name,
    description: config.description,
    type: "menu",
    icon: config.icon,
    binding: menuBinding,
    actions: config.actions.map(convertActionRef),
  };
};

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
  const menus = useReactiveVar(menusVar);
  useReactiveVar(menuStateVar);
  const currentMenu = getCurrentMenu();
  useListenToEntityProp(selection, "order");
  useListenToEntityProp(selection, "mana");
  useListenToEntityProp(selection, "inventory");
  const localPlayer = useLocalPlayer();

  // Listen to gold changes on the owning player's entity
  const owningPlayer = getPlayer(selection?.owner);
  useListenToEntityProp(owningPlayer, "gold");

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
        convertMenuConfigToAction(menu, menus, shortcuts, selection.prefab!)
      );
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
