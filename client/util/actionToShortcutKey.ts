import { Entity } from "../ecs.ts";
import { UnitDataAction } from "../../shared/types.ts";

export const actionToShortcutKey = (
  action: NonNullable<Entity["actions"]>[number],
  menuContext?: string,
) => {
  const baseKey = action.type === "build"
    ? `build-${action.unitType}`
    : action.type === "purchase"
    ? `purchase-${action.itemId}`
    : action.type === "menu"
    ? action.name.toLowerCase().replace(/\s+/g, "-")
    : action.order;

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
