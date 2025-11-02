import { makeVar } from "@/hooks/useVar.tsx";
import { items } from "@/shared/data.ts";

export type MenuConfig = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  binding?: string[];
  prefabs: string[]; // Which prefabs this menu applies to
  actions: Array<MenuActionRef | MenuConfig>; // Can nest menus
};

export type MenuActionRef = {
  type: "action";
  actionKey: string; // References action by its shortcut key
} | {
  type: "purchase";
  itemId: string;
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

const loadMenusFromStorage = (): MenuConfig[] => {
  const deletedMenus = deletedMenusVar();

  try {
    const stored = localStorage.getItem("menus");
    if (stored) {
      const storedMenus: MenuConfig[] = JSON.parse(stored);
      // Merge stored non-default menus with default menus
      // Start with default menus, then add/override with stored menus
      const menuMap = new Map<string, MenuConfig>();

      // Add defaults first, filtering out deleted ones
      for (const menu of defaultMenus) {
        const deletedPrefabs = deletedMenus[menu.id] || [];
        // Remove deleted prefabs from the menu
        const remainingPrefabs = menu.prefabs.filter(
          (p) => !deletedPrefabs.includes(p),
        );
        if (remainingPrefabs.length > 0) {
          menuMap.set(menu.id, { ...menu, prefabs: remainingPrefabs });
        }
      }

      // Add/override with stored menus
      for (const menu of storedMenus) {
        menuMap.set(menu.id, menu);
      }

      return Array.from(menuMap.values());
    }
  } catch {
    // Ignore parse errors
  }

  // Filter defaults by deletedMenus
  return defaultMenus
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

// Helper to check if a menu matches its default
export const isDefaultMenu = (menu: MenuConfig): boolean => {
  const defaultMenu = defaultMenus.find((m) => m.id === menu.id);
  if (!defaultMenu) return false;

  // Compare all properties (deep equality check)
  return (
    menu.name === defaultMenu.name &&
    menu.description === defaultMenu.description &&
    menu.icon === defaultMenu.icon &&
    JSON.stringify(menu.binding) === JSON.stringify(defaultMenu.binding) &&
    JSON.stringify(menu.prefabs) === JSON.stringify(defaultMenu.prefabs) &&
    JSON.stringify(menu.actions) === JSON.stringify(defaultMenu.actions)
  );
};

// Filter out default menus before saving
const filterNonDefaultMenus = (menus: MenuConfig[]): MenuConfig[] =>
  menus.filter((menu) => !isDefaultMenu(menu));

// Calculate which default menus have been deleted per prefab
const calculateDeletedMenus = (currentMenus: MenuConfig[]): DeletedMenus => {
  const deleted: DeletedMenus = {};

  for (const defaultMenu of defaultMenus) {
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
