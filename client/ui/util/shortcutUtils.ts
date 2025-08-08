import { z } from "npm:zod";
import { pluck } from "../../util/pluck.ts";
import { items, prefabs } from "../../../shared/data.ts";
import {
  actionToShortcutKey,
  getMenuShortcutKeys,
} from "../../util/actionToShortcutKey.ts";

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
};

export const defaultBindings: Shortcuts = {
  misc: {
    openCommandPalette: ["Slash"],
    openChat: ["Enter"],
    cancel: ["Backquote"],
    selectOwnUnit: ["Digit1"],
    selectMirrors: ["Digit2"],
  },
  ...Object.fromEntries(
    Object.entries(prefabs).filter(([, d]) => d.actions?.length).map((
      [u, d],
    ) => [
      u,
      Object.fromEntries(
        [
          ...d.actions!.map((a) => [actionToShortcutKey(a), a.binding ?? []]),
          // Add menu shortcuts as nested entries
          ...d.actions!
            .filter((a) => a.type === "menu")
            .flatMap((menuAction) => {
              const menuName = actionToShortcutKey(menuAction);
              const menuShortcuts = getMenuShortcutKeys(menuAction, menuName);
              return Object.entries(menuShortcuts).map(([key, binding]) => [
                key,
                binding,
              ]);
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
            // Add menu shortcuts as nested entries
            ...d.actions!
              .filter((a) => a.type === "menu")
              .flatMap((menuAction) => {
                const menuName = actionToShortcutKey(menuAction);
                const menuShortcuts = getMenuShortcutKeys(menuAction, menuName);
                return Object.entries(menuShortcuts).map(([key, binding]) => {
                  // For nested keys like "shop.back", we need to access the stored shortcuts differently
                  // The key contains dots, so we need to access it directly from the section
                  const storedSectionShortcuts = pluck(
                    localStorageShortcuts,
                    u,
                    z.record(z.string(), zShortcut),
                  );
                  const storedBinding = storedSectionShortcuts?.[key];
                  return [
                    key,
                    storedBinding ?? binding,
                  ];
                });
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
    }

    return key;
  }
};
