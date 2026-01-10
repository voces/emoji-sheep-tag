import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Entity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";
import { lookup } from "../systems/lookup.ts";
import { getCurrentMenu } from "../ui/vars/menuState.ts";
import {
  actionToShortcutKey,
  menuActionRefToKey,
} from "../util/actionToShortcutKey.ts";
import { normalizeKey, normalizeKeys } from "../util/normalizeKey.ts";
import { getLocalPlayer } from "../api/player.ts";
import { canPlayerExecuteAction } from "../util/allyPermissions.ts";
import { menusVar } from "../ui/vars/menus.ts";
import { convertMenuConfigToAction } from "../util/convertMenuConfigToAction.ts";

export const keyboard: Record<string, boolean> = {};
export const normalizedKeyboard: Record<string, boolean> = {};

const getActionsInMenusForSelection = (
  selection: Iterable<Entity>,
): Set<string> => {
  const menus = menusVar();
  const actionsInMenus = new Set<string>();

  for (const entity of selection) {
    if (entity.prefab) {
      const prefabMenus = menus.filter((menu) =>
        menu.prefabs.includes(entity.prefab!)
      );
      for (const menu of prefabMenus) {
        for (const menuAction of menu.actions) {
          if ("type" in menuAction) {
            actionsInMenus.add(menuActionRefToKey(menuAction));
          }
        }
      }
    }
  }

  return actionsInMenus;
};

export const isSameAction = (a: UnitDataAction, b: UnitDataAction) => {
  switch (a.type) {
    case "auto":
      return b.type === "auto" && a.order === b.order;
    case "build":
      return b.type === "build" && a.unitType === b.unitType;
    case "upgrade":
      return b.type === "upgrade" && a.prefab === b.prefab;
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
): number => {
  const normalizedShortcut = normalizeKeys(shortcut);
  const matches = (!currentKey ||
    normalizedShortcut.includes(normalizeKey(currentKey))) &&
    normalizedShortcut.every((s) => normalizedKeyboard[s]);
  return matches ? normalizedShortcut.length : 0;
};

export const findActionForShortcut = (
  e: KeyboardEvent,
  shortcuts: Record<string, Record<string, string[]>>,
): { units: Entity[]; action: UnitDataAction | undefined } => {
  const units: Entity[] = [];
  let action: UnitDataAction | undefined;
  let bestMatchQuality = 0;

  const currentMenu = getCurrentMenu();
  const menuUnit = currentMenu ? lookup(currentMenu.unitId) : undefined;

  if (currentMenu && menuUnit) {
    // Check menu actions
    for (const a of currentMenu.action.actions) {
      if (!a.binding) continue;
      const matchQuality = checkShortcut(a.binding, e.code);
      if (matchQuality) {
        if (matchQuality > bestMatchQuality) {
          // Better match found, replace
          bestMatchQuality = matchQuality;
          action = a;
          units.length = 0;
          units.push(menuUnit);
        } else if (
          matchQuality === bestMatchQuality && isSameAction(action!, a)
        ) {
          // Same quality and same action type
          units.push(menuUnit);
        }
      }
    }
  } else {
    // Get actions that are in menus for filtering
    const actionsInMenus = getActionsInMenusForSelection(selection);

    // Check selection actions
    for (const entity of selection) {
      // Check unit's base actions
      if (entity.actions) {
        for (const a of entity.actions) {
          // Skip actions that are in menus
          const actionKey = actionToShortcutKey(a);
          if (actionsInMenus.has(actionKey)) {
            continue;
          }

          if (a.binding) {
            const matchQuality = checkShortcut(a.binding, e.code);
            if (matchQuality) {
              const localPlayer = getLocalPlayer();
              if (
                localPlayer && canPlayerExecuteAction(localPlayer.id, entity, a)
              ) {
                if (matchQuality > bestMatchQuality) {
                  // Better match found, replace
                  bestMatchQuality = matchQuality;
                  action = a;
                  units.length = 0;
                  units.push(entity);
                } else if (
                  matchQuality === bestMatchQuality && isSameAction(action!, a)
                ) {
                  // Same quality and same action type
                  units.push(entity);
                }
              }
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

              if (binding) {
                const matchQuality = checkShortcut(binding, e.code);
                if (matchQuality) {
                  if (matchQuality > bestMatchQuality) {
                    // Better match found, replace
                    bestMatchQuality = matchQuality;
                    action = itemAction;
                    units.length = 0;
                    units.push(entity);
                  } else if (
                    matchQuality === bestMatchQuality &&
                    isSameAction(action!, itemAction)
                  ) {
                    // Same quality and same action type
                    units.push(entity);
                  }
                }
              }
            }
          }
        }
      }

      // Check menu actions for this entity
      if (entity.prefab) {
        const allMenus = menusVar();
        const prefabMenus = allMenus.filter((menu) =>
          menu.prefabs.includes(entity.prefab!)
        );
        for (const menu of prefabMenus) {
          // Convert menu config to full action with all sub-actions
          const menuAction = convertMenuConfigToAction(
            menu,
            allMenus,
            shortcuts,
            entity,
          );

          // Skip menus that only have a back action or are empty
          const nonBackActions = menuAction.actions.filter((a) =>
            a.type !== "auto" || a.order !== "back"
          );
          if (nonBackActions.length === 0) {
            continue;
          }

          if (menuAction.binding) {
            const matchQuality = checkShortcut(menuAction.binding, e.code);
            if (matchQuality) {
              if (matchQuality > bestMatchQuality) {
                bestMatchQuality = matchQuality;
                action = menuAction;
                units.length = 0;
                units.push(entity);
              } else if (
                matchQuality === bestMatchQuality &&
                isSameAction(action!, menuAction)
              ) {
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
