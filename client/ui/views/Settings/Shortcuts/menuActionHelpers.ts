import { items, prefabs } from "@/shared/data.ts";
import type { MenuConfig } from "@/vars/menus.ts";
import { menuActionRefToKey } from "../../../../util/actionToShortcutKey.ts";
import { actionToShortcutKey } from "../../../../util/actionToShortcutKey.ts";
import { menusVar } from "@/vars/menus.ts";

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

/**
 * Gets the icon for an action key in a given section.
 * Returns the icon name or undefined if no icon is found.
 */
export const getActionIcon = (
  actionKey: string,
  section: string,
): string | undefined => {
  // No icons for misc section
  if (section === "misc") {
    return undefined;
  }

  // Back action (check before menu- prefix since menu-back-* also starts with menu-)
  if (actionKey === "back" || actionKey.startsWith("menu-back-")) {
    return "cancel";
  }

  // Menu binding key (e.g., "menu-shop")
  if (actionKey.startsWith("menu-") && !actionKey.includes(".")) {
    const menuId = actionKey.replace("menu-", "");
    const menus = menusVar();
    const menu = menus.find((m) => m.id === menuId);
    if (menu?.icon) return menu.icon;
    return "shop";
  }

  // Purchase action
  if (actionKey.startsWith("purchase-")) {
    const itemId = actionKey.replace("purchase-", "");
    return items[itemId]?.icon ?? itemId;
  }

  // Build action
  if (actionKey.startsWith("build-")) {
    const unitType = actionKey.replace("build-", "");
    return prefabs[unitType]?.model ?? unitType;
  }

  // Upgrade action
  if (actionKey.startsWith("upgrade-")) {
    const prefab = actionKey.replace("upgrade-", "");
    return prefabs[prefab]?.model ?? prefab;
  }

  // Cancel upgrade
  if (actionKey === "cancel-upgrade") {
    return "cancel";
  }

  // Look up in prefab actions
  const prefab = prefabs[section];
  if (prefab?.actions) {
    for (const action of prefab.actions) {
      if (actionToShortcutKey(action) === actionKey) {
        if ("icon" in action && action.icon) return action.icon;
        if ("order" in action) return action.order;
        if (action.type === "build") {
          return prefabs[action.unitType]?.model ?? undefined;
        }
      }
    }
  }

  // Check item actions
  for (const item of Object.values(items)) {
    if (item.actions) {
      for (const itemAction of item.actions) {
        if (actionToShortcutKey(itemAction) === actionKey) {
          if ("icon" in itemAction && itemAction.icon) return itemAction.icon;
          if ("order" in itemAction) return itemAction.order;
        }
      }
    }
  }

  return undefined;
};
