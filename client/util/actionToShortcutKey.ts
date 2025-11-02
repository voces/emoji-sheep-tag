import { Entity } from "../ecs.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import type { MenuActionRef } from "@/vars/menus.ts";

/**
 * Converts a MenuActionRef to its shortcut key for filtering.
 * This function exhaustively handles all MenuActionRef types.
 */
export const menuActionRefToKey = (ref: MenuActionRef): string => {
  switch (ref.type) {
    case "action":
      return ref.actionKey;
    case "purchase":
      return `purchase-${ref.itemId}`;
    default:
      return absurd(ref);
  }
};

export const actionToShortcutKey = (
  action: NonNullable<Entity["actions"]>[number],
  menuContext?: string,
): string => {
  const baseKey: string = (() => {
    switch (action.type) {
      case "build":
        return `build-${action.unitType}`;
      case "purchase":
        return `purchase-${action.itemId}`;
      case "menu":
        return action.name.toLowerCase().replace(/\s+/g, "-");
      case "upgrade":
        return `upgrade-${action.prefab}`;
      case "auto":
      case "target":
        return action.order;
      default:
        return absurd(action);
    }
  })();

  return menuContext ? `${menuContext}.${baseKey}` : baseKey;
};

export const getMenuShortcutKeys = (
  menuAction: UnitDataAction & { type: "menu" },
  menuName: string,
): Record<string, ReadonlyArray<string>> => {
  const shortcuts: Record<string, ReadonlyArray<string>> = {};

  for (const subAction of menuAction.actions) {
    const key = actionToShortcutKey(subAction, menuName);
    shortcuts[key] = subAction.binding ?? [];
  }

  return shortcuts;
};
