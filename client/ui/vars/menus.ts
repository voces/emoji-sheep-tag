import { makeVar } from "@/hooks/useVar.tsx";
import { items } from "@/shared/data.ts";
import { presetOverrides } from "./presets.ts";
import { shortcutSettingsVar } from "./shortcutSettings.ts";

export type MenuConfig = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  binding?: string[];
  prefabs: string[]; // Which prefabs this menu applies to
  actions: Array<MenuActionRef | MenuConfig>; // Can nest menus
  bindingOverrides?: Record<string, string[]>; // actionKey → alt binding when this menu is active
};

export type MenuActionRef = {
  type: "action";
  actionKey: string; // References action by its shortcut key
} | {
  type: "purchase";
  itemId: string;
};

export const getActiveDefaultMenus = (): MenuConfig[] => {
  const { preset } = shortcutSettingsVar();
  return [...defaultMenus, ...presetOverrides[preset].menus];
};

export const defaultMenus: MenuConfig[] = [
  {
    id: "shop",
    name: "Shop",
    icon: "shop",
    binding: ["KeyB"],
    prefabs: ["wolf"],
    actions: [
      { type: "action", actionKey: "back" },
      ...Object.keys(items).map((itemId): MenuActionRef => ({
        type: "purchase",
        itemId,
      })),
    ],
  },
  {
    id: "editor",
    name: "Editor",
    binding: ["KeyE"],
    prefabs: ["editor"],
    actions: [
      { type: "action", actionKey: "back" },
    ],
  },
];

// Track which default menu IDs have been explicitly deleted per prefab
// Format: { "menuId": ["prefab1", "prefab2"], ... }
type DeletedMenus = Record<string, string[]>;

const loadDeletedMenusFromStorage = (): DeletedMenus => {
  try {
    const stored = localStorage.getItem("deletedMenus");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
};

export const deletedMenusVar = makeVar<DeletedMenus>(
  loadDeletedMenusFromStorage(),
);

export const loadMenusFromStorage = (): MenuConfig[] => {
  const deletedMenus = deletedMenusVar();
  const activeDefaults = getActiveDefaultMenus();

  // Build set of prefabs covered by preset menus to avoid duplicates
  const { preset } = shortcutSettingsVar();
  const presetMenuPrefabs = new Set(
    presetOverrides[preset].menus.flatMap((m) => m.prefabs),
  );

  try {
    const stored = localStorage.getItem("menus");
    if (stored) {
      const storedMenus: MenuConfig[] = JSON.parse(stored);
      const menuMap = new Map<string, MenuConfig>();

      for (const menu of activeDefaults) {
        const deletedPrefabs = deletedMenus[menu.id] || [];
        const remainingPrefabs = menu.prefabs.filter(
          (p) => !deletedPrefabs.includes(p),
        );
        if (remainingPrefabs.length > 0) {
          menuMap.set(menu.id, { ...menu, prefabs: remainingPrefabs });
        }
      }

      for (const menu of storedMenus) {
        // Skip user build menus that conflict with preset menus
        if (
          menu.id.startsWith("build-") &&
          menu.prefabs.some((p) => presetMenuPrefabs.has(p))
        ) continue;
        menuMap.set(menu.id, menu);
      }

      return Array.from(menuMap.values());
    }
  } catch {
    // Ignore parse errors
  }

  return activeDefaults
    .map((menu) => {
      const deletedPrefabs = deletedMenus[menu.id] || [];
      const remainingPrefabs = menu.prefabs.filter(
        (p) => !deletedPrefabs.includes(p),
      );
      if (remainingPrefabs.length === 0) return null;
      return { ...menu, prefabs: remainingPrefabs };
    })
    .filter((m): m is MenuConfig => m !== null);
};

export const menusVar = makeVar<MenuConfig[]>(loadMenusFromStorage());

// Get a stable key for sorting menu actions
const getActionSortKey = (action: MenuActionRef | MenuConfig): string => {
  if ("type" in action) {
    if (action.type === "action") return `action:${action.actionKey}`;
    if (action.type === "purchase") return `purchase:${action.itemId}`;
  }
  return `menu:${action.id}`;
};

// Sort actions for consistent comparison
const sortActions = (actions: Array<MenuActionRef | MenuConfig>) =>
  [...actions].sort((a, b) =>
    getActionSortKey(a).localeCompare(getActionSortKey(b))
  );

// Helper to check if a menu matches its default
export const isDefaultMenu = (menu: MenuConfig): boolean => {
  const defaultMenu = getActiveDefaultMenus().find((m) => m.id === menu.id);
  if (!defaultMenu) return false;

  // Sort actions before comparing to ignore order differences
  const sortedMenuActions = sortActions(menu.actions);
  const sortedDefaultActions = sortActions(defaultMenu.actions);

  return (
    menu.name === defaultMenu.name &&
    menu.description === defaultMenu.description &&
    menu.icon === defaultMenu.icon &&
    JSON.stringify(menu.binding) === JSON.stringify(defaultMenu.binding) &&
    JSON.stringify(menu.prefabs) === JSON.stringify(defaultMenu.prefabs) &&
    JSON.stringify(sortedMenuActions) === JSON.stringify(sortedDefaultActions)
  );
};

// Filter out default menus before saving
const filterNonDefaultMenus = (menus: MenuConfig[]): MenuConfig[] =>
  menus.filter((menu) => !isDefaultMenu(menu));

// Calculate which default menus have been deleted per prefab
const calculateDeletedMenus = (currentMenus: MenuConfig[]): DeletedMenus => {
  const deleted: DeletedMenus = {};

  for (const defaultMenu of getActiveDefaultMenus()) {
    const currentMenu = currentMenus.find((m) => m.id === defaultMenu.id);

    if (!currentMenu) {
      // Menu completely deleted - all prefabs deleted
      deleted[defaultMenu.id] = [...defaultMenu.prefabs];
    } else {
      // Check which prefabs were removed
      const deletedPrefabs = defaultMenu.prefabs.filter(
        (p) => !currentMenu.prefabs.includes(p),
      );
      if (deletedPrefabs.length > 0) {
        deleted[defaultMenu.id] = deletedPrefabs;
      }
    }
  }

  return deleted;
};

// When preset changes, rebuild menus from storage
shortcutSettingsVar.subscribe(() => {
  menusVar(loadMenusFromStorage());
});

// Save to localStorage whenever menus change
let previousMenus = menusVar();
let previousDeletedMenus = deletedMenusVar();

setInterval(() => {
  const currentMenus = menusVar();
  const currentDeletedMenus = deletedMenusVar();

  if (currentMenus !== previousMenus) {
    previousMenus = currentMenus;
    const nonDefaultMenus = filterNonDefaultMenus(currentMenus);
    localStorage.setItem("menus", JSON.stringify(nonDefaultMenus));

    // Update deleted menus tracking
    const newDeletedMenus = calculateDeletedMenus(currentMenus);
    if (
      JSON.stringify(newDeletedMenus) !== JSON.stringify(currentDeletedMenus)
    ) {
      deletedMenusVar(newDeletedMenus);
    }
  }

  if (currentDeletedMenus !== previousDeletedMenus) {
    previousDeletedMenus = currentDeletedMenus;
    localStorage.setItem("deletedMenus", JSON.stringify(currentDeletedMenus));
  }
}, 100);
