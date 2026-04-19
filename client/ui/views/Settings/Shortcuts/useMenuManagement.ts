import { useCallback, useMemo, useState } from "react";
import type { MenuActionRef, MenuConfig } from "@/vars/menus.ts";
import { getActiveDefaultMenus, menusVar } from "@/vars/menus.ts";
import {
  buildActionsInMenusSet,
  createMenuActionRef,
  findMenuForAction,
  removeActionFromMenuVar,
} from "./menuActionHelpers.ts";
import { prefabs } from "@/shared/data.ts";
import { actionToShortcutKey } from "../../../../util/actionToShortcutKey.ts";

export const useMenuManagement = (
  section: string,
) => {
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);

  const deleteMenu = useCallback((menuId: string) => {
    setMenuToDelete(menuId);
  }, []);

  const confirmDeleteMenu = useCallback(() => {
    setMenuToDelete((currentMenuToDelete) => {
      if (!currentMenuToDelete) return currentMenuToDelete;
      menusVar(menusVar().filter((m) => m.id !== currentMenuToDelete));
      return null;
    });
  }, []);

  const cancelDeleteMenu = useCallback(() => {
    setMenuToDelete(null);
  }, []);

  const addActionToMenu = useCallback((menuId: string, actionKey: string) => {
    // Don't allow adding Back action
    if (actionKey === "back" || actionKey.startsWith("menu-back-")) return;

    const menus = menusVar();
    const menu = menus.find((m) => m.id === menuId);
    if (!menu) return;

    // Find if this action is already in another menu
    const sectionMenus = menus.filter((m) => m.prefabs.includes(section));
    const existingMenuId = findMenuForAction(actionKey, sectionMenus);

    // If already in this menu, do nothing
    if (existingMenuId === menuId) return;

    if (existingMenuId) {
      removeActionFromMenuVar(existingMenuId, actionKey);
    }

    const actionRef = createMenuActionRef(actionKey);
    const currentMenus = menusVar();
    menusVar(
      currentMenus.map((m) =>
        m.id === menuId ? { ...m, actions: [...m.actions, actionRef] } : m
      ),
    );
  }, [section]);

  const removeActionFromMenu = useCallback(
    (menuId: string, actionKey: string) => {
      if (actionKey === "back" || actionKey.startsWith("menu-back-")) return;
      removeActionFromMenuVar(menuId, actionKey);
    },
    [],
  );

  const updateMenuIcon = useCallback(
    (menuId: string, icon: string | undefined) => {
      menusVar(
        menusVar().map((m) => m.id === menuId ? { ...m, icon } : m),
      );
    },
    [],
  );

  const updateMenuName = useCallback(
    (menuId: string, name: string) => {
      if (!name.trim()) return;
      menusVar(
        menusVar().map((m) =>
          m.id === menuId ? { ...m, name: name.trim() } : m
        ),
      );
    },
    [],
  );

  const createMenu = useCallback(() => {
    const newMenu: MenuConfig = {
      id: `menu-${Date.now()}`,
      name: "New Menu",
      prefabs: [section],
      actions: [{ type: "action", actionKey: "back" }],
    };
    menusVar([...menusVar(), newMenu]);
  }, [section]);

  const restoreDefaultMenu = useCallback((menuId: string) => {
    const defaultMenu = getActiveDefaultMenus().find((m) => m.id === menuId);
    if (!defaultMenu) return;

    const menus = menusVar();
    // Check if menu already exists
    const existingMenu = menus.find((m) => m.id === menuId);
    if (existingMenu) {
      // Menu exists - add current section to its prefabs if not already there
      if (!existingMenu.prefabs.includes(section)) {
        menusVar(
          menus.map((m) =>
            m.id === menuId ? { ...m, prefabs: [...m.prefabs, section] } : m
          ),
        );
      }
    } else {
      // Menu doesn't exist - create it with only the current section
      const restoredMenu = {
        ...defaultMenu,
        prefabs: [section],
      };
      menusVar([...menus, restoredMenu]);
    }
  }, [section]);

  const getDeletedDefaultMenus = useCallback(
    () =>
      getActiveDefaultMenus().filter((defaultMenu) =>
        defaultMenu.prefabs.includes(section) &&
        !menusVar().some((m) => m.id === defaultMenu.id)
      ),
    [section],
  );

  const createBuildMenu = useCallback(() => {
    const prefab = prefabs[section];
    if (!prefab?.actions) return;

    // Get all build actions for this prefab
    const buildActions = prefab.actions.filter((action) =>
      action.type === "build"
    );

    if (buildActions.length === 0) return;

    // Find non-build actions that conflict with the build menu's KeyB binding
    const buildActionKeys = new Set(
      buildActions.map((a) => actionToShortcutKey(a)),
    );
    const conflicting = prefab.actions.filter((a) => {
      const key = actionToShortcutKey(a);
      return !buildActionKeys.has(key) &&
        a.binding?.length === 1 && a.binding[0] === "KeyB";
    });

    // Keys freed by moving build actions into the menu, sorted alphabetically
    const freedKeys = buildActions
      .filter((a) => a.binding?.length === 1)
      .map((a) => a.binding![0])
      .sort();

    // Assign freed keys to conflicting actions
    let bindingOverrides: Record<string, string[]> | undefined;
    if (conflicting.length > 0) {
      bindingOverrides = {};
      let freedIdx = 0;
      for (const a of conflicting) {
        const freed = freedKeys[freedIdx++];
        bindingOverrides[actionToShortcutKey(a)] = freed ? [freed] : [];
      }
    }

    // Create menu with all build actions
    const buildMenu: MenuConfig = {
      id: `build-${Date.now()}`,
      name: "Build",
      icon: "construction",
      prefabs: [section],
      binding: ["KeyB"],
      actions: [
        { type: "action", actionKey: "back" },
        ...buildActions.map((action): MenuActionRef => ({
          type: "action",
          actionKey: `build-${action.unitType}`,
        })),
      ],
      bindingOverrides,
    };

    menusVar([...menusVar(), buildMenu]);
  }, [section]);

  const hasNestedBuildActions = useCallback(() => {
    const prefab = prefabs[section];
    if (!prefab?.actions) return false;

    // Get all build actions for this prefab
    const buildActions = prefab.actions.filter((action) =>
      action.type === "build"
    );

    if (buildActions.length === 0) return false;

    // Get all actions that are currently in menus
    const sectionMenus = menusVar().filter((m) => m.prefabs.includes(section));
    const actionsInMenus = buildActionsInMenusSet(sectionMenus);

    // Check if ANY build actions are already in menus (nested)
    return buildActions.some((action) => {
      const buildActionKey = `build-${action.unitType}`;
      return actionsInMenus.has(buildActionKey);
    });
  }, [section]);

  const deletion = useMemo(() => ({
    menuToDelete,
    deleteMenu,
    confirm: confirmDeleteMenu,
    cancel: cancelDeleteMenu,
  }), [menuToDelete, deleteMenu, confirmDeleteMenu, cancelDeleteMenu]);

  const actions = useMemo(() => ({
    add: addActionToMenu,
    remove: removeActionFromMenu,
    updateIcon: updateMenuIcon,
    updateName: updateMenuName,
  }), [addActionToMenu, removeActionFromMenu, updateMenuIcon, updateMenuName]);

  const creation = useMemo(() => ({
    createMenu,
    createBuildMenu,
    hasNestedBuildActions,
  }), [createMenu, createBuildMenu, hasNestedBuildActions]);

  const restoration = useMemo(() => ({
    restore: restoreDefaultMenu,
    getDeleted: getDeletedDefaultMenus,
  }), [restoreDefaultMenu, getDeletedDefaultMenus]);

  return useMemo(() => ({
    deletion,
    actions,
    creation,
    restoration,
  }), [deletion, actions, creation, restoration]);
};
