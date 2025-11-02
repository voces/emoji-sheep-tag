import { items } from "@/shared/data.ts";
import type { MenuConfig } from "@/vars/menus.ts";
import { menuActionRefToKey } from "../../../../util/actionToShortcutKey.ts";

export type MenuActionInfo = {
  actionKey: string;
  displayName: string;
  defaultBinding: string[];
};

/**
 * Converts a menu action (MenuActionRef or nested MenuConfig) to a normalized info object.
 * This consolidates the logic for determining action keys, display names, and default bindings.
 */
export const getMenuActionInfo = (
  action: MenuConfig["actions"][number],
  menuId: string,
): MenuActionInfo => {
  if ("type" in action) {
    // MenuActionRef
    if (action.type === "purchase") {
      return {
        actionKey: `purchase-${action.itemId}`,
        displayName: `Purchase ${items[action.itemId]?.name ?? action.itemId}`,
        defaultBinding: items[action.itemId]?.binding
          ? [...items[action.itemId].binding]
          : [],
      };
    }

    // action.type === "action"
    if (action.actionKey === "back") {
      return {
        actionKey: `menu-back-${menuId}`,
        displayName: "Back",
        defaultBinding: ["Backquote"],
      };
    }

    return {
      actionKey: action.actionKey,
      displayName: action.actionKey,
      defaultBinding: [],
    };
  }

  // Nested menu config
  return {
    actionKey: `submenu-${action.id}`,
    displayName: `Menu: ${action.name}`,
    defaultBinding: action.binding ?? [],
  };
};

/**
 * Builds a set of action keys that are currently in menus.
 * Used to filter them out from top-level shortcuts display.
 */
export const buildActionsInMenusSet = (
  menus: MenuConfig[],
): Set<string> => {
  const actionsInMenus = new Set<string>();

  for (const menu of menus) {
    for (const action of menu.actions) {
      if ("type" in action) {
        actionsInMenus.add(menuActionRefToKey(action));
      }
    }
  }

  return actionsInMenus;
};

/**
 * Finds which menu (if any) contains the given action key.
 */
export const findMenuForAction = (
  actionKey: string,
  menus: MenuConfig[],
): string | null => {
  for (const menu of menus) {
    for (const action of menu.actions) {
      if ("type" in action) {
        if (menuActionRefToKey(action) === actionKey) {
          return menu.id;
        }
      }
    }
  }
  return null;
};

/**
 * Creates a MenuActionRef from an action key.
 */
export const createMenuActionRef = (
  actionKey: string,
): MenuConfig["actions"][number] => {
  if (actionKey.startsWith("purchase-")) {
    const itemId = actionKey.replace("purchase-", "");
    return { type: "purchase", itemId };
  }
  return { type: "action", actionKey };
};
