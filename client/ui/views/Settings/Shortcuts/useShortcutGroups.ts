import { useMemo } from "react";
import { items } from "@/shared/data.ts";
import type { MenuConfig } from "@/vars/menus.ts";
import type { ConflictInfo } from "@/util/shortcutUtils.ts";
import { detectMenuConflicts } from "@/util/shortcutUtils.ts";
import {
  buildActionsInMenusSet,
  getMenuActionInfo,
} from "./menuActionHelpers.ts";

export type ShortcutGroups = {
  topLevelShortcuts: Record<string, string[]>;
  menuShortcuts: Record<string, Record<string, string[]>>;
  topLevelConflicts: Map<string, ConflictInfo>;
  menuConflicts: Record<string, Map<string, ConflictInfo>>;
  hasConflicts: boolean;
};

/**
 * Organizes shortcuts into top-level and menu-level groups,
 * and detects conflicts for each group.
 */
export const useShortcutGroups = (
  shortcuts: Record<string, string[]>,
  sectionMenus: MenuConfig[],
  section: string,
): ShortcutGroups => {
  return useMemo(() => {
    // Build a set of actions that are in menus to filter them out from top-level
    const actionsInMenus = buildActionsInMenusSet(sectionMenus);

    // Group shortcuts by menu context (nested vs top-level)
    const topLevelShortcuts: Record<string, string[]> = {};
    const menuShortcuts: Record<string, Record<string, string[]>> = {};
    const menuBindings: Record<string, string[]> = {}; // Menu hotkeys (e.g., "menu-shop")

    for (const [key, binding] of Object.entries(shortcuts)) {
      if (key.includes(".")) {
        const [menuName, actionKey] = key.split(".", 2);
        if (!menuShortcuts[menuName]) {
          menuShortcuts[menuName] = {};
        }
        menuShortcuts[menuName][actionKey] = binding;
      } else if (key.startsWith("menu-")) {
        menuBindings[key] = binding;
      } else {
        if (actionsInMenus.has(key)) {
          continue;
        }
        topLevelShortcuts[key] = binding;
      }
    }

    for (const menu of sectionMenus) {
      const menuKey = `menu-${menu.id}`;
      if (!menuBindings[menuKey] && menu.binding && menu.binding.length > 0) {
        menuBindings[menuKey] = menu.binding;
      }
    }

    // Detect conflicts within top-level shortcuts (including menu bindings)
    // Skip conflict detection for misc section
    const allTopLevel = { ...topLevelShortcuts, ...menuBindings };
    const topLevelConflicts = section === "misc"
      ? new Map<string, ConflictInfo>()
      : detectMenuConflicts(allTopLevel);

    const menuConflicts: Record<string, Map<string, ConflictInfo>> = {};
    if (section !== "misc") {
      // Check legacy menu shortcuts (backwards compatibility)
      for (const [menuName, menuBindings] of Object.entries(menuShortcuts)) {
        menuConflicts[menuName] = detectMenuConflicts(menuBindings);
      }

      // Check new menu system - group actions by which menu they're in
      for (const menu of sectionMenus) {
        const menuKey = `menu-${menu.id}`;
        const menuActions: Record<string, string[]> = {};

        for (const action of menu.actions) {
          const actionInfo = getMenuActionInfo(action, menu.id);

          // Get the binding for this action
          let binding: string[];
          if ("type" in action && action.type === "purchase") {
            binding = shortcuts[actionInfo.actionKey] ??
              items[action.itemId]?.binding ??
              [];
          } else {
            binding = shortcuts[actionInfo.actionKey] ?? [];
          }

          if (binding.length > 0) {
            menuActions[actionInfo.actionKey] = binding;
          }
        }

        menuConflicts[menuKey] = detectMenuConflicts(menuActions);
      }
    }

    // Check if there are any conflicts (top-level or menu-level)
    const hasConflicts = topLevelConflicts.size > 0 ||
      Object.values(menuConflicts).some((menuConflict) =>
        menuConflict.size > 0
      );

    return {
      topLevelShortcuts,
      menuShortcuts,
      topLevelConflicts,
      menuConflicts,
      hasConflicts,
    };
  }, [shortcuts, sectionMenus, section]);
};
