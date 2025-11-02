import { makeVar } from "@/hooks/useVar.tsx";
import {
  createInitialShortcuts,
  defaultBindings,
  type Shortcuts,
} from "@/util/shortcutUtils.ts";
import { menusVar } from "./menus.ts";

// Helper function to load menu bindings from localStorage
const loadMenuBindingsFromStorage = (
  currentShortcuts: Shortcuts,
  allMenus: ReturnType<typeof menusVar>,
): Shortcuts => {
  const updatedShortcuts = { ...currentShortcuts };

  // Load menu bindings from localStorage for all menus
  const localStorageShortcuts = (() => {
    try {
      return JSON.parse(localStorage.getItem("shortcuts") ?? "");
    } catch {
      return {};
    }
  })();

  // For each menu, load its binding from localStorage
  for (const menu of allMenus) {
    for (const prefab of menu.prefabs) {
      const menuBindingKey = `menu-${menu.id}`;
      const storedSectionShortcuts = localStorageShortcuts[prefab];
      const storedBinding = storedSectionShortcuts?.[menuBindingKey];

      if (storedBinding) {
        if (!updatedShortcuts[prefab]) {
          updatedShortcuts[prefab] = {};
        }
        updatedShortcuts[prefab][menuBindingKey] = storedBinding;
      }
    }
  }

  return updatedShortcuts;
};

// Initialize shortcuts with menu bindings loaded from localStorage
const initialShortcuts = createInitialShortcuts();
const initialMenus = menusVar();
const shortcutsWithMenuBindings = loadMenuBindingsFromStorage(
  initialShortcuts,
  initialMenus,
);

export const shortcutsVar = makeVar<Shortcuts>(shortcutsWithMenuBindings);

menusVar.subscribe(() => {
  const currentShortcuts = shortcutsVar();
  const allMenus = menusVar();

  let updatedShortcuts = loadMenuBindingsFromStorage(
    currentShortcuts,
    allMenus,
  );

  const validMenuIds = new Set(allMenus.map((menu) => menu.id));

  for (const [section, shortcuts] of Object.entries(currentShortcuts)) {
    if (section === "misc") continue;

    const defaultSection = defaultBindings[section];
    if (!defaultSection) continue;

    const sectionShortcuts: Record<string, string[]> = {
      ...updatedShortcuts[section],
    };

    for (const [key, binding] of Object.entries(defaultSection)) {
      if (!shortcuts[key]) {
        sectionShortcuts[key] = binding;
      }
    }

    for (const key of Object.keys(sectionShortcuts)) {
      if (key.startsWith("menu-") && !key.includes(".")) {
        const menuId = key.substring(5);
        if (!validMenuIds.has(menuId)) {
          delete sectionShortcuts[key];
        }
      }
    }

    updatedShortcuts = {
      ...updatedShortcuts,
      [section]: sectionShortcuts,
    };
  }

  if (JSON.stringify(updatedShortcuts) !== JSON.stringify(currentShortcuts)) {
    shortcutsVar(updatedShortcuts);
  }
});
