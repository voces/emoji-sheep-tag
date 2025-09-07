import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { lookup } from "../systems/lookup.ts";
import { getCurrentMenu } from "../ui/vars/menuState.ts";
import { actionToShortcutKey } from "../util/actionToShortcutKey.ts";
import { normalizeKey, normalizeKeys } from "../util/normalizeKey.ts";
import { getLocalPlayer } from "@/vars/players.ts";
import { canPlayerExecuteAction } from "../util/allyPermissions.ts";

export const keyboard: Record<string, boolean> = {};
export const normalizedKeyboard: Record<string, boolean> = {};

export const isSameAction = (a: UnitDataAction, b: UnitDataAction) => {
  switch (a.type) {
    case "auto":
      return b.type === "auto" && a.order === b.order;
    case "build":
      return b.type === "build" && a.unitType === b.unitType;
    case "target":
      return b.type === "target" && a.order === b.order;
    case "purchase":
      return b.type === "purchase" && a.itemId === b.itemId;
    case "menu":
      return b.type === "menu";
    default:
      absurd(a);
  }
};

export const checkShortcut = (
  shortcut: readonly string[],
  currentKey?: string,
) => {
  const normalizedShortcut = normalizeKeys(shortcut);
  return (!currentKey ||
    normalizedShortcut.includes(normalizeKey(currentKey))) &&
    normalizedShortcut.every((s) => normalizedKeyboard[s]);
};

export const findActionForShortcut = (
  e: KeyboardEvent,
  shortcuts: Record<string, Record<string, string[]>>,
): { units: Entity[]; action: UnitDataAction | undefined } => {
  const units: Entity[] = [];
  let action: UnitDataAction | undefined;

  const currentMenu = getCurrentMenu();
  const menuUnit = currentMenu ? lookup[currentMenu.unitId] : undefined;

  if (currentMenu && menuUnit) {
    // Check menu actions
    for (const a of currentMenu.action.actions) {
      if (!a.binding) continue;
      if (
        checkShortcut(a.binding, e.code) && (!action || isSameAction(action, a))
      ) {
        action = a;
        units.push(menuUnit);
      }
    }
  } else {
    // Check selection actions
    for (const entity of selection) {
      // Check unit's base actions
      if (entity.actions) {
        for (const a of entity.actions) {
          if (
            a.binding && checkShortcut(a.binding, e.code) &&
            (!action || isSameAction(action, a))
          ) {
            const localPlayer = getLocalPlayer();
            if (
              localPlayer && canPlayerExecuteAction(localPlayer.id, entity, a)
            ) {
              action = a;
              units.push(entity);
            }
          }
        }
      }

      // Check item actions from inventory
      if (entity.inventory) {
        for (const item of entity.inventory) {
          if (
            item.actions && item.actions.length > 0 &&
            (!item.charges || item.charges > 0)
          ) {
            for (const itemAction of item.actions) {
              const prefabShortcuts = entity.prefab
                ? shortcuts[entity.prefab]
                : undefined;
              const actionKey = actionToShortcutKey(itemAction);
              const binding = prefabShortcuts?.[actionKey] ??
                itemAction.binding;

              if (
                binding && checkShortcut(binding, e.code) &&
                (!action || isSameAction(action, itemAction))
              ) {
                action = itemAction;
                units.push(entity);
              }
            }
          }
        }
      }
    }
  }

  return { units, action };
};

export const handleKeyDown = (code: string) => {
  keyboard[code] = true;
  normalizedKeyboard[normalizeKey(code)] = true;
};

export const handleKeyUp = (code: string) => {
  delete keyboard[code];
  delete normalizedKeyboard[normalizeKey(code)];
};

export const clearKeyboard = () => {
  for (const key in keyboard) delete keyboard[key];
  for (const key in normalizedKeyboard) delete normalizedKeyboard[key];
};
