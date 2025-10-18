import { z } from "zod";
import { pluck } from "../../util/pluck.ts";
import { items, prefabs } from "@/shared/data.ts";
import {
  actionToShortcutKey,
  getMenuShortcutKeys,
} from "../../util/actionToShortcutKey.ts";

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
  selectOwnUnit: "Select primary unit",
  selectMirrors: "Select mirror images",
  selectFoxes: "Select foxes",
  queueModifier: "Queue actions modifier",
  addToSelectionModifier: "Add to selection modifier",
  ping: "Ping location",
  applyZoom: "Apply zoom",
};

export const defaultBindings: Shortcuts = {
  misc: {
    openCommandPalette: ["Slash"],
    openChat: ["Enter"],
    cancel: ["Backquote"],
    selectOwnUnit: ["Digit1"],
    selectMirrors: ["Digit2"],
    selectFoxes: ["Digit3"],
    queueModifier: ["ShiftLeft"],
    addToSelectionModifier: ["ShiftLeft"],
    ping: ["AltLeft", "KeyG"],
    applyZoom: ["Backquote"],
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
        ],
      ),
    ]),
  ),
};

export const createInitialShortcuts = (): Shortcuts => ({
  misc: { // Potential conflict with a `misc` unitType?
    openCommandPalette: pluckShortcut("misc.openCommandPalette") ?? ["Slash"],
    openChat: pluckShortcut("misc.openChat") ?? ["Enter"],
    cancel: pluckShortcut("misc.cancel") ?? ["Backquote"],
    selectOwnUnit: pluckShortcut("misc.selectOwnUnit") ?? ["Digit1"],
    selectMirrors: pluckShortcut("misc.selectMirrors") ?? ["Digit2"],
    selectFoxes: pluckShortcut("misc.selectFoxes") ?? ["Digit3"],
    queueModifier: pluckShortcut("misc.queueModifier") ?? ["ShiftLeft"],
    addToSelectionModifier: pluckShortcut("misc.addToSelectionModifier") ??
      ["ShiftLeft"],
    ping: pluckShortcut("misc.ping") ?? ["AltLeft", "KeyG"],
    applyZoom: pluckShortcut("misc.applyZoom") ?? ["Backquote"],
  },
  ...Object.fromEntries(
    Object.entries(prefabs).filter(([, d]) => d.actions?.length)
      .map((
        [u, d],
      ) => [
        u,
        Object.fromEntries(
          [
            ...d.actions!.map((
              a,
            ) => [
              actionToShortcutKey(a),
              pluckShortcut(`${u}.${actionToShortcutKey(a)}`) ?? a.binding ??
                [],
            ]),
            // Add cancel-upgrade entry if this prefab can be upgraded to
            ...(upgradeTargets.has(u)
              ? [[
                "cancel-upgrade",
                pluckShortcut(`${u}.cancel-upgrade`) ?? ["Backquote"],
              ]]
              : []),
            // Add menu shortcuts as nested entries
            ...d.actions!
              .filter((a) => a.type === "menu")
              .flatMap((menuAction) => {
                const menuName = actionToShortcutKey(menuAction);
                const menuShortcuts = getMenuShortcutKeys(menuAction, menuName);
                const storedSectionShortcuts = pluck(
                  localStorageShortcuts,
                  u,
                  z.record(z.string(), zShortcut),
                );

                const shortcuts = Object.entries(menuShortcuts).map(
                  ([key, binding]) => {
                    // For nested keys like "shop.back", we need to access the stored shortcuts differently
                    // The key contains dots, so we need to access it directly from the section
                    const storedBinding = storedSectionShortcuts?.[key];
                    return [
                      key,
                      storedBinding ?? binding,
                    ];
                  },
                );

                // Also add shortcuts for item actions from purchase actions
                for (const subAction of menuAction.actions) {
                  if (
                    subAction.type === "purchase" && items[subAction.itemId]
                  ) {
                    const item = items[subAction.itemId];
                    if (item.actions) {
                      for (const itemAction of item.actions) {
                        const itemKey = actionToShortcutKey(itemAction);
                        const storedBinding = storedSectionShortcuts?.[itemKey];
                        shortcuts.push([
                          itemKey,
                          storedBinding ?? pluckShortcut(`${u}.${itemKey}`) ??
                            itemAction.binding ?? [],
                        ]);
                      }
                    }
                  }
                }

                return shortcuts;
              }),
          ],
        ),
      ]),
  ),
});

export const getActionDisplayName = (
  key: string,
  section: string,
): string => {
  if (section === "misc") {
    return miscNames[key as keyof typeof miscNames] || key;
  } else if (key === "cancel-upgrade") {
    return "Cancel upgrade";
  } else if (key.startsWith("purchase-")) {
    const itemId = key.replace("purchase-", "");
    return `Purchase ${items[itemId]?.name ?? itemId}`;
  } else {
    // Try to find the action name
    const action = prefabs[section]?.actions?.find((a) =>
      actionToShortcutKey(a) === key
    );
    if (action) return action.name;

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

    return key;
  }
};
