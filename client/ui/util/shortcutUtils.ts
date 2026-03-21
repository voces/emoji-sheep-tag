import { z } from "zod";
import { pluck } from "../../util/pluck.ts";
import { items, prefabs } from "@/shared/data.ts";
import {
  actionToShortcutKey,
  getMenuShortcutKeys,
} from "../../util/actionToShortcutKey.ts";
import { menusVar } from "@/vars/menus.ts";
import { shortcutSettingsVar } from "@/vars/shortcutSettings.ts";
import { presetOverrides } from "@/vars/presets.ts";

// Find all prefabs that can be upgraded to, and map them to their source prefabs
const getUpgradeTargets = (): Map<string, string[]> => {
  const upgradeTargets = new Map<string, string[]>();

  for (const [prefabId, prefab] of Object.entries(prefabs)) {
    if (prefab.actions) {
      for (const action of prefab.actions) {
        if (action.type === "upgrade") {
          const targetPrefab = action.prefab;
          if (!upgradeTargets.has(targetPrefab)) {
            upgradeTargets.set(targetPrefab, []);
          }
          upgradeTargets.get(targetPrefab)!.push(prefabId);
        }
      }
    }
  }

  return upgradeTargets;
};

const upgradeTargets = getUpgradeTargets();

const localStorageShortcuts = (() => {
  try {
    return JSON.parse(localStorage.getItem("shortcuts") ?? "") as unknown;
  } catch { /* do nothing */ }
})();

const zShortcut = z.string().array();
const pluckShortcut = (path: string) =>
  pluck(localStorageShortcuts, path, zShortcut);

export type Shortcuts = Record<
  string,
  Record<string, string[]>
>;

export const miscNames = {
  openCommandPalette: "Open command palette",
  openChat: "Open chat",
  cancel: "Cancel",
  queueModifier: "Queue actions modifier",
  addToSelectionModifier: "Add to selection modifier",
  ping: "Ping location",
  jumpToPing: "Jump to ping",
  applyZoom: "Apply zoom",
  toggleScoreboard: "Toggle scoreboard",
  cycleSelection: "Cycle selection focus",
};

export const controlGroupNames: Record<string, string> = {
  group1: "Group 1 — Primary unit",
  group2: "Group 2 — Mirrors",
  group3: "Group 3 — Foxes",
  group4: "Group 4",
  group5: "Group 5",
  group6: "Group 6",
  group7: "Group 7",
  group8: "Group 8",
  group9: "Group 9",
  group0: "Group 10",
  assignModifier: "Assign group modifier",
};

export const controlGroupTooltips: Record<string, string> = {
  group1: "Always selects your primary unit (sheep, wolf, or spirit).",
  group2:
    "Selects mirror images for wolves. Custom group for sheep (assign with modifier + key).",
  group3:
    "Selects foxes for wolves. Custom group for sheep (assign with modifier + key).",
};

export const SLOT_COUNT = 6;
export const slotDefaults: [string, string[]][] = [
  ["slot-1", ["Numpad7"]],
  ["slot-2", ["Numpad8"]],
  ["slot-3", ["Numpad4"]],
  ["slot-4", ["Numpad5"]],
  ["slot-5", ["Numpad1"]],
  ["slot-6", ["Numpad2"]],
];

export const ALT_SEPARATOR = "~";

export const getBaseKey = (key: string): string => {
  const idx = key.indexOf(ALT_SEPARATOR);
  return idx === -1 ? key : key.substring(0, idx);
};

export const isAltKey = (key: string): boolean => key.includes(ALT_SEPARATOR);

export const getAltIndex = (key: string): number => {
  const idx = key.indexOf(ALT_SEPARATOR);
  return idx === -1 ? -1 : Number(key.substring(idx + 1));
};

export const makeAltKey = (baseKey: string, index: number): string =>
  `${baseKey}${ALT_SEPARATOR}${index}`;

export const bindingsEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((key, i) => key === b[i]);

export const isDefaultBinding = (
  section: string,
  fullKey: string,
  shortcut: string[],
  defaults: Shortcuts,
): boolean => {
  // Handle menu-specific Back action keys
  if (fullKey.startsWith("menu-back-")) {
    const defaultBackBinding = ["Backquote"];
    return bindingsEqual(shortcut, defaultBackBinding);
  }

  // Handle menu binding keys (e.g., "menu-shop", "menu-menu-123")
  if (fullKey.startsWith("menu-")) {
    const menuId = fullKey.substring(5); // Remove "menu-" prefix
    const allMenus = menusVar();
    const menu = allMenus.find((m) =>
      m.id === menuId && m.prefabs.includes(section)
    );

    if (!menu) {
      // Menu doesn't exist for this section
      return false;
    }

    const defaultMenuBinding = menu.binding ?? [];
    return bindingsEqual(shortcut, defaultMenuBinding);
  }

  // Alt bindings: check if value matches this key's default or any preset alt on the same base
  if (isAltKey(fullKey)) {
    const effective = getEffectiveDefault(section, fullKey);
    if (bindingsEqual(shortcut, effective)) return true;
    if (shortcut.length === 0) return effective.length === 0;
    const base = getBaseKey(fullKey);
    return getPresetAltDefaults(section, base).some((pa) =>
      pa.binding.length > 0 && bindingsEqual(shortcut, pa.binding)
    );
  }

  const defaultBinding = defaults[section]?.[fullKey];
  if (!defaultBinding) return false;

  return bindingsEqual(shortcut, getEffectiveDefault(section, fullKey));
};

export const defaultBindings: Shortcuts = {
  misc: {
    openCommandPalette: ["Slash"],
    openChat: ["Enter"],
    cancel: ["Backquote"],
    queueModifier: ["ShiftLeft"],
    addToSelectionModifier: ["ShiftLeft"],
    ping: ["AltLeft", "KeyG"],
    jumpToPing: ["Space"],
    applyZoom: ["Backquote"],
    toggleScoreboard: ["Backquote"],
    cycleSelection: ["Tab"],
  },
  controlGroups: {
    group1: ["Digit1"],
    group2: ["Digit2"],
    group3: ["Digit3"],
    group4: ["Digit4"],
    group5: ["Digit5"],
    group6: ["Digit6"],
    group7: ["Digit7"],
    group8: ["Digit8"],
    group9: ["Digit9"],
    group0: ["Digit0"],
    assignModifier: ["ControlLeft"],
  },
  ...Object.fromEntries(
    Object.entries(prefabs).filter(([, d]) => d.actions?.length).map((
      [u, d],
    ) => [
      u,
      Object.fromEntries(
        [
          ...d.actions!.map((a) => [actionToShortcutKey(a), a.binding ?? []]),
          // Add cancel-upgrade entry if this prefab can be upgraded to
          ...(upgradeTargets.has(u) ? [["cancel-upgrade", ["Backquote"]]] : []),
          // Add menu shortcuts as nested entries
          ...d.actions!
            .filter((a) => a.type === "menu")
            .flatMap((menuAction) => {
              const menuName = actionToShortcutKey(menuAction);
              const menuShortcuts = getMenuShortcutKeys(menuAction, menuName);
              const shortcuts = Object.entries(menuShortcuts).map((
                [key, binding],
              ) => [
                key,
                binding,
              ]);

              // Also add shortcuts for item actions from purchase actions
              for (const subAction of menuAction.actions) {
                if (subAction.type === "purchase" && items[subAction.itemId]) {
                  const item = items[subAction.itemId];
                  if (item.actions) {
                    for (const itemAction of item.actions) {
                      const itemKey = actionToShortcutKey(itemAction);
                      shortcuts.push([itemKey, itemAction.binding ?? []]);
                    }
                  }
                }
              }

              return shortcuts;
            }),
          // Add shortcuts for item actions if this prefab has inventory
          ...("inventory" in d
            ? [
              ...Object.values(items).flatMap((item) => {
                if (!item.actions) return [];
                return item.actions.map((itemAction) => [
                  actionToShortcutKey(itemAction),
                  itemAction.binding ?? [],
                ]);
              }),
              ...slotDefaults,
            ]
            : []),
        ],
      ),
    ]),
  ),
};

export const getEffectiveDefault = (
  section: string,
  fullKey: string,
): string[] => {
  const base = defaultBindings[section]?.[fullKey] ?? [];
  const { preset } = shortcutSettingsVar();
  const overrides = presetOverrides[preset].bindings;
  const presetBinding = overrides[section]?.[fullKey];
  if (presetBinding) return presetBinding;
  const allMenus = menusVar();
  for (const m of allMenus) {
    if (m.prefabs.includes(section) && m.bindingOverrides?.[fullKey]) {
      return m.bindingOverrides[fullKey];
    }
  }
  return base;
};

export const getPresetAltDefaults = (
  section: string,
  baseKey: string,
): { key: string; binding: string[] }[] => {
  const { preset } = shortcutSettingsVar();
  const overrides = presetOverrides[preset].bindings[section];
  if (!overrides) return [];
  const results: { key: string; binding: string[] }[] = [];
  for (const [key, binding] of Object.entries(overrides)) {
    if (isAltKey(key) && getBaseKey(key) === baseKey && binding.length > 0) {
      results.push({ key, binding });
    }
  }
  return results;
};

export const createInitialShortcuts = (): Shortcuts => {
  const result: Shortcuts = {};

  for (const [section, bindings] of Object.entries(defaultBindings)) {
    const sectionResult: Record<string, string[]> = {};

    for (const [key, defaultValue] of Object.entries(bindings)) {
      sectionResult[key] = pluckShortcut(`${section}.${key}`) ?? defaultValue;
    }

    // Load alt bindings from localStorage for prefab sections
    if (section !== "misc" && section !== "controlGroups") {
      const stored = pluck(
        localStorageShortcuts,
        section,
        z.record(z.string(), zShortcut),
      );
      if (stored) {
        for (const [key, binding] of Object.entries(stored)) {
          if (key.includes(ALT_SEPARATOR)) sectionResult[key] = binding;
        }
      }
    }

    result[section] = sectionResult;
  }

  return result;
};

export const getActionDisplayName = (
  key: string,
  section: string,
): string => {
  if (section === "controlGroups") {
    if (controlGroupNames[key]) return controlGroupNames[key];
    // Cross-section conflict: search all prefabs for the action name
    for (const [, prefab] of Object.entries(prefabs)) {
      const found = prefab.actions?.find((a) => actionToShortcutKey(a) === key);
      if (found) return found.name;
    }
    return key;
  } else if (section === "misc") {
    return miscNames[key as keyof typeof miscNames] || key;
  } else if (key.startsWith("slot-")) {
    return `Item slot ${key.substring(5)}`;
  } else if (key === "cancel-upgrade") {
    return "Cancel upgrade";
  } else if (key.startsWith("menu-back-")) {
    return "Back";
  } else if (key.startsWith("menu-")) {
    // Handle menu-prefixed actions like "menu-shop.purchase-foxToken"
    const dotIndex = key.indexOf(".");
    if (dotIndex !== -1) {
      const actionPart = key.substring(dotIndex + 1);
      if (actionPart.startsWith("purchase-")) {
        const itemId = actionPart.replace("purchase-", "");
        return `Purchase ${items[itemId]?.name ?? itemId}`;
      }
      // For other menu actions, return the action part
      return actionPart;
    }
    // Menu binding key (e.g., "menu-shop" or "menu-123123421")
    // Try to find the menu name from menusVar
    const menuId = key.replace("menu-", "");
    const menus = menusVar();
    const menu = menus.find((m) => m.id === menuId);
    if (menu) return menu.name;
    return key;
  } else if (key.startsWith("purchase-")) {
    const itemId = key.replace("purchase-", "");
    return `Purchase ${items[itemId]?.name ?? itemId}`;
  } else {
    // Try to find the action name
    const action = prefabs[section]?.actions?.find((a) =>
      actionToShortcutKey(a) === key
    );
    if (action) return action.name;

    // Check if this is an item action (for prefabs with inventory)
    if ("inventory" in (prefabs[section] || {})) {
      for (const item of Object.values(items)) {
        if (item.actions) {
          for (const itemAction of item.actions) {
            if (actionToShortcutKey(itemAction) === key) {
              return itemAction.name;
            }
          }
        }
      }
    }

    // For menu actions, find them in the menu's actions
    const menuAction = prefabs[section]?.actions?.find((a) =>
      a.type === "menu"
    );
    if (menuAction && menuAction.type === "menu") {
      const subAction = menuAction.actions.find((subAction) =>
        actionToShortcutKey(subAction) === key
      );
      if (subAction) return subAction.name;

      // Check if this is an item action from a purchase action
      for (const subAction of menuAction.actions) {
        if (subAction.type === "purchase" && items[subAction.itemId]) {
          const item = items[subAction.itemId];
          if (item.actions) {
            for (const itemAction of item.actions) {
              if (actionToShortcutKey(itemAction) === key) {
                return itemAction.name;
              }
            }
          }
        }
      }
    }

    // Search all prefabs for the action name (for cross-section conflicts)
    for (const [, prefab] of Object.entries(prefabs)) {
      const found = prefab.actions?.find((a) => actionToShortcutKey(a) === key);
      if (found) return found.name;
    }

    return controlGroupNames[key] || key;
  }
};

export type ConflictInfo = {
  actionKey: string;
  conflictsWith: Array<
    { actionKey: string; fullKey: string; section?: string }
  >;
};

export const detectConflicts = (
  shortcuts: Record<string, string[]>,
): Map<string, ConflictInfo> => {
  const conflicts = new Map<string, ConflictInfo>();
  const bindingMap = new Map<string, string[]>();

  // Build a map of bindings to action keys
  for (const [key, binding] of Object.entries(shortcuts)) {
    if (binding.length === 0) continue;

    const bindingStr = binding.join("+");
    const existing = bindingMap.get(bindingStr) ?? [];
    existing.push(key);
    bindingMap.set(bindingStr, existing);
  }

  // Find conflicts
  for (const [, keys] of bindingMap.entries()) {
    if (keys.length > 1) {
      for (const key of keys) {
        const conflictsWith = keys
          .filter((k) => k !== key)
          .map((k) => ({ actionKey: k, fullKey: k }));
        conflicts.set(key, { actionKey: key, conflictsWith });
      }
    }
  }

  return conflicts;
};

export const detectMenuConflicts = (
  menuShortcuts: Record<string, string[]>,
): Map<string, ConflictInfo> => {
  const conflicts = new Map<string, ConflictInfo>();
  const bindingMap = new Map<string, string[]>();

  // Build a map of bindings to action keys within this menu
  for (const [key, binding] of Object.entries(menuShortcuts)) {
    if (binding.length === 0) continue;

    const bindingStr = binding.join("+");
    const existing = bindingMap.get(bindingStr) ?? [];
    existing.push(key);
    bindingMap.set(bindingStr, existing);
  }

  // Find conflicts within the menu
  for (const [, keys] of bindingMap.entries()) {
    if (keys.length > 1) {
      for (const key of keys) {
        const conflictsWith = keys
          .filter((k) => k !== key)
          .map((k) => ({ actionKey: k, fullKey: key }));
        conflicts.set(key, { actionKey: key, conflictsWith });
      }
    }
  }

  return conflicts;
};
