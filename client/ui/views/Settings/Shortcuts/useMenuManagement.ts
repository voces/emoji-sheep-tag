import { useState } from "react";
import type { MenuActionRef, MenuConfig } from "@/vars/menus.ts";
import { defaultMenus, menusVar } from "@/vars/menus.ts";
import {
  buildActionsInMenusSet,
  createMenuActionRef,
} from "./menuActionHelpers.ts";
import { prefabs } from "@/shared/data.ts";

export const useMenuManagement = (
  menus: MenuConfig[],
  section: string,
) => {
  const [editMenuForm, setEditMenuForm] = useState<MenuConfig | null>(null);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);

  const startEditMenu = (menu: MenuConfig) => {
    setEditMenuForm(menu);
  };

  const saveEditMenu = () => {
    if (!editMenuForm?.name) return;
    // Update name, description, and icon from the form
    menusVar(
      menus.map((m) =>
        m.id === editMenuForm.id
          ? {
            ...m,
            name: editMenuForm.name,
            description: editMenuForm.description,
            icon: editMenuForm.icon,
          }
          : m
      ),
    );
    setEditMenuForm(null);
  };

  const cancelEditMenu = () => {
    if (!editMenuForm) return;
    // Restore the original menu state from editMenuForm
    menusVar(
      menus.map((m) => m.id === editMenuForm.id ? editMenuForm : m),
    );
    setEditMenuForm(null);
  };

  const deleteMenu = (menuId: string) => {
    setMenuToDelete(menuId);
  };

  const confirmDeleteMenu = () => {
    if (!menuToDelete) return;
    setEditMenuForm(null);
    menusVar(menus.filter((m) => m.id !== menuToDelete));
    setMenuToDelete(null);
  };

  const cancelDeleteMenu = () => {
    setMenuToDelete(null);
  };

  const addActionToMenu = (menuId: string, actionKey: string) => {
    // Don't allow adding Back action
    if (actionKey === "back" || actionKey.startsWith("menu-back-")) return;

    if (editMenuForm?.id === menuId) {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) return;

      const actionRef = createMenuActionRef(actionKey);

      // Add the action to the menu immediately
      const updatedMenu = {
        ...menu,
        actions: [...menu.actions, actionRef],
      };

      menusVar(menus.map((m) => (m.id === menuId ? updatedMenu : m)));
    }
  };

  const removeActionFromMenu = (menuId: string, actionKey: string) => {
    // Don't allow removing Back action
    if (actionKey === "back" || actionKey.startsWith("menu-back-")) return;

    if (editMenuForm?.id === menuId) {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) return;

      // Remove the action from the menu immediately
      const updatedActions = menu.actions.filter((action) => {
        if ("type" in action) {
          if (action.type === "purchase") {
            return `purchase-${action.itemId}` !== actionKey;
          }
          return action.actionKey !== actionKey;
        }
        return true; // Keep nested menus
      });

      const updatedMenu = {
        ...menu,
        actions: updatedActions,
      };

      menusVar(menus.map((m) => (m.id === menuId ? updatedMenu : m)));
    }
  };

  const createMenu = () => {
    const newMenu: MenuConfig = {
      id: `menu-${Date.now()}`,
      name: "New Menu",
      prefabs: [section],
      actions: [{ type: "action", actionKey: "back" }],
    };
    menusVar([...menus, newMenu]);
    startEditMenu(newMenu);
  };

  const updateEditMenuForm = (updates: Partial<MenuConfig>) => {
    if (!editMenuForm) return;
    setEditMenuForm({ ...editMenuForm, ...updates });
  };

  const restoreDefaultMenu = (menuId: string) => {
    const defaultMenu = defaultMenus.find((m) => m.id === menuId);
    if (!defaultMenu) return;

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
  };

  const getDeletedDefaultMenus = () =>
    defaultMenus.filter((defaultMenu) =>
      defaultMenu.prefabs.includes(section) &&
      !menus.some((m) => m.id === defaultMenu.id)
    );

  const createBuildMenu = () => {
    const prefab = prefabs[section];
    if (!prefab?.actions) return;

    // Get all build actions for this prefab
    const buildActions = prefab.actions.filter((action) =>
      action.type === "build"
    );

    if (buildActions.length === 0) return;

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
    };

    menusVar([...menus, buildMenu]);
    startEditMenu(buildMenu);
  };

  const hasTopLevelBuildActions = () => {
    const prefab = prefabs[section];
    if (!prefab?.actions) return false;

    // Get all build actions for this prefab
    const buildActions = prefab.actions.filter((action) =>
      action.type === "build"
    );

    if (buildActions.length === 0) return false;

    // Get all actions that are currently in menus
    const sectionMenus = menus.filter((m) => m.prefabs.includes(section));
    const actionsInMenus = buildActionsInMenusSet(sectionMenus);

    // Check if ANY build action is NOT in a menu (i.e., at top level)
    return buildActions.some((action) => {
      const buildActionKey = `build-${action.unitType}`;
      return !actionsInMenus.has(buildActionKey);
    });
  };

  return {
    editing: {
      form: editMenuForm,
      start: startEditMenu,
      save: saveEditMenu,
      cancel: cancelEditMenu,
      updateForm: updateEditMenuForm,
    },
    deletion: {
      menuToDelete,
      deleteMenu,
      confirm: confirmDeleteMenu,
      cancel: cancelDeleteMenu,
    },
    actions: {
      add: addActionToMenu,
      remove: removeActionFromMenu,
    },
    creation: {
      createMenu,
      createBuildMenu,
      hasTopLevelBuildActions,
    },
    restoration: {
      restore: restoreDefaultMenu,
      getDeleted: getDeletedDefaultMenus,
    },
  };
};
