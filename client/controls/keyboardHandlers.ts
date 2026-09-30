import { UnitDataAction } from "@/shared/types.ts";
import { ALT_SEPARATOR, SLOT_COUNT } from "../ui/util/shortcutUtils.ts";
import { shortcutSettingsVar } from "../ui/vars/shortcutSettings.ts";
import { shortcutsVar } from "../ui/vars/shortcuts.ts";
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

const checkSingleBinding = (
  shortcut: readonly string[],
  currentKey?: string,
): number => {
  const normalizedShortcut = normalizeKeys(shortcut);
  const matches = (!currentKey ||
    normalizedShortcut.includes(normalizeKey(currentKey))) &&
    normalizedShortcut.every((s) => normalizedKeyboard[s]);
  return matches ? normalizedShortcut.length : 0;
};

const checkAltBindings = (
  sectionShortcuts: Record<string, string[]>,
  actionKey: string,
  currentKey?: string,
): number => {
  for (const key in sectionShortcuts) {
    if (!key.startsWith(actionKey + ALT_SEPARATOR)) continue;
    const alt = sectionShortcuts[key];
    const q = alt.length > 0 ? checkSingleBinding(alt, currentKey) : 0;
    if (q) return q;
  }
  return 0;
};

const checkWithAlts = (
  primary: readonly string[] | undefined,
  actionKey: string,
  prefabShortcuts: Record<string, string[]> | undefined,
  currentKey?: string,
): number =>
  (primary ? checkSingleBinding(primary, currentKey) : 0) ||
  (prefabShortcuts
    ? checkAltBindings(prefabShortcuts, actionKey, currentKey)
    : 0);

/**
 * Check a shortcut and all its alt bindings in a section.
 * Returns match quality (number of keys) or 0 if no match.
 */
export const checkShortcut = (
  sectionShortcuts: Record<string, string[]>,
  actionKey: string,
  currentKey?: string,
): number =>
  checkWithAlts(
    sectionShortcuts[actionKey],
    actionKey,
    sectionShortcuts,
    currentKey,
  );

export const isQueueModifierHeld = () =>
  checkShortcut(shortcutsVar().misc, "queueModifier") > 0;

const getUsableItemActions = (entity: Entity): UnitDataAction[] =>
  entity.inventory?.flatMap((item) =>
    item.actions?.length && (!item.charges || item.charges > 0)
      ? item.actions
      : []
  ) ?? [];

export const findActionForShortcut = (
  e: KeyboardEvent,
  shortcuts: Record<string, Record<string, string[]>>,
): { units: Entity[]; action: UnitDataAction | undefined } => {
  const units: Entity[] = [];
  let action: UnitDataAction | undefined;
  let bestMatchQuality = 0;

  // A better match replaces the pick; an equal match of the same action adds
  // its unit, unless ties are disallowed
  const consider = (
    matchQuality: number,
    candidate: UnitDataAction,
    unit: Entity,
    allowTies = true,
  ) => {
    if (!matchQuality) return;
    if (matchQuality > bestMatchQuality) {
      bestMatchQuality = matchQuality;
      action = candidate;
      units.length = 0;
      units.push(unit);
    } else if (
      allowTies && matchQuality === bestMatchQuality &&
      isSameAction(action!, candidate)
    ) units.push(unit);
  };

  const currentMenu = getCurrentMenu();
  const menuUnit = currentMenu ? lookup(currentMenu.unitId) : undefined;

  if (currentMenu && menuUnit) {
    for (const a of currentMenu.action.actions) {
      if (a.binding) {
        consider(checkSingleBinding(a.binding, e.code), a, menuUnit);
      }
    }
    return { units, action };
  }

  // Actions reachable through a menu only trigger via that menu
  const actionsInMenus = getActionsInMenusForSelection(selection);
  const { useSlotBindings } = shortcutSettingsVar();

  for (const entity of selection) {
    const prefabShortcuts = entity.prefab
      ? shortcuts[entity.prefab]
      : undefined;

    for (const a of entity.actions ?? []) {
      const actionKey = actionToShortcutKey(a);
      if (actionsInMenus.has(actionKey)) continue;

      const matchQuality = checkWithAlts(
        a.binding,
        actionKey,
        prefabShortcuts,
        e.code,
      );
      if (!matchQuality) continue;
      const localPlayer = getLocalPlayer();
      if (localPlayer && canPlayerExecuteAction(localPlayer.id, entity, a)) {
        consider(matchQuality, a, entity);
      }
    }

    if (entity.inventory && !useSlotBindings) {
      for (const itemAction of getUsableItemActions(entity)) {
        const actionKey = actionToShortcutKey(itemAction);
        consider(
          checkWithAlts(
            prefabShortcuts?.[actionKey] ?? itemAction.binding,
            actionKey,
            prefabShortcuts,
            e.code,
          ),
          itemAction,
          entity,
        );
      }
    }

    if (entity.inventory && prefabShortcuts && useSlotBindings) {
      const usableActions = getUsableItemActions(entity);
      for (let i = 0; i < Math.min(usableActions.length, SLOT_COUNT); i++) {
        const slotBinding = prefabShortcuts[`slot-${i + 1}`];
        if (!slotBinding) continue;
        consider(
          checkSingleBinding(slotBinding, e.code),
          usableActions[i],
          entity,
          false,
        );
      }
    }

    if (entity.prefab) {
      const allMenus = menusVar();
      for (const menu of allMenus) {
        if (!menu.prefabs.includes(entity.prefab)) continue;
        const menuAction = convertMenuConfigToAction(
          menu,
          allMenus,
          shortcuts,
          entity,
        );

        // Skip menus that only have a back action or are empty
        if (
          !menuAction.binding ||
          menuAction.actions.every((a) =>
            a.type === "auto" && a.order === "back"
          )
        ) continue;

        consider(
          checkSingleBinding(menuAction.binding, e.code),
          menuAction,
          entity,
        );
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
