import { UnitDataAction } from "@/shared/types.ts";
import { actionToShortcutKey } from "./actionToShortcutKey.ts";
import { Shortcuts } from "../ui/util/shortcutUtils.ts";

/**
 * Apply shortcut overrides to an action based on user preferences
 */
export const applyShortcutOverride = <T extends UnitDataAction>(
  action: T,
  shortcuts: Shortcuts,
  prefab: string,
): T => {
  const sectionShortcuts = shortcuts[prefab];
  if (!sectionShortcuts) return action;

  const shortcutKey = actionToShortcutKey(action);
  const overrideBinding = sectionShortcuts[shortcutKey];

  if (
    overrideBinding && (
      !action.binding ||
      action.binding.length !== overrideBinding.length ||
      !action.binding.every((v, i) => v === overrideBinding[i])
    )
  ) {
    return { ...action, binding: overrideBinding };
  }

  return action;
};

/**
 * Apply shortcut overrides to menu actions recursively
 */
export const applyShortcutOverrideToMenu = (
  action: UnitDataAction & { type: "menu" },
  shortcuts: Shortcuts,
  prefab: string,
): UnitDataAction => {
  const sectionShortcuts = shortcuts[prefab];
  if (!sectionShortcuts) return action;

  // First apply override to the menu action itself
  let updatedAction = applyShortcutOverride(action, shortcuts, prefab);

  // Then recursively apply to sub-actions
  if (updatedAction.type === "menu") {
    const menuAction = updatedAction as UnitDataAction & { type: "menu" };
    const menuName = actionToShortcutKey(menuAction);
    const updatedSubActions = menuAction.actions.map((subAction) => {
      // For sub-actions in a menu, we need to check both with and without menu context
      const menuContextKey = `${menuName}.${actionToShortcutKey(subAction)}`;
      const overrideBinding = sectionShortcuts[menuContextKey] ??
        sectionShortcuts[actionToShortcutKey(subAction)];

      if (
        overrideBinding && (
          !subAction.binding ||
          subAction.binding.length !== overrideBinding.length ||
          !subAction.binding.every((v, i) => v === overrideBinding[i])
        )
      ) {
        return { ...subAction, binding: overrideBinding };
      }
      return subAction;
    });

    if (
      updatedSubActions.some((newSub, i) => newSub !== menuAction.actions[i])
    ) {
      updatedAction = { ...menuAction, actions: updatedSubActions };
    }
  }

  return updatedAction;
};
