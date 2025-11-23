import { Entity } from "../ecs.ts";
import { MenuActionRef, MenuConfig } from "@/vars/menus.ts";
import { nonNull, UnitDataAction } from "@/shared/types.ts";
import { items } from "@/shared/data.ts";
import { actionToShortcutKey } from "./actionToShortcutKey.ts";

/**
 * Converts a menu configuration to a UnitDataAction for a specific entity.
 * Only includes actions that the entity actually has in its actions array.
 */
export const convertMenuConfigToAction = (
  config: MenuConfig,
  allConfigs: MenuConfig[],
  shortcuts: Record<string, Record<string, string[]>>,
  entity: Entity,
): UnitDataAction & { type: "menu" } => {
  const section = entity.prefab!;

  const convertActionRef = (
    ref: MenuActionRef | MenuConfig,
  ): UnitDataAction | undefined => {
    if ("id" in ref) {
      // It's a nested menu config
      return convertMenuConfigToAction(ref, allConfigs, shortcuts, entity);
    }
    if (ref.type === "action") {
      // Back action
      if (ref.actionKey === "back") {
        const actionKey = `menu-back-${config.id}`;
        const binding = shortcuts[section]?.[actionKey] ?? ["Backquote"];
        return {
          name: "Back",
          type: "auto",
          order: "back",
          icon: "cancel",
          binding,
        };
      }
      // Look up the action from the entity's actions
      const entityAction = entity.actions?.find((a) =>
        actionToShortcutKey(a) === ref.actionKey
      );
      if (entityAction) {
        // Get binding from shortcuts (using the action key, not menu-prefixed)
        const binding = shortcuts[section]?.[ref.actionKey] ??
          entityAction.binding ?? [];
        return {
          ...entityAction,
          binding,
        };
      }
      // Action not found on entity, return undefined to filter it out
      return undefined;
    }
    // Purchase action - check if entity has a purchase action with this itemId
    const hasPurchaseAction = entity.actions?.some((a) =>
      a.type === "purchase" && a.itemId === ref.itemId
    );
    if (!hasPurchaseAction) {
      return undefined;
    }

    const item = items[ref.itemId];
    const actionKey = `menu-${config.id}.purchase-${ref.itemId}`;
    const binding = shortcuts[section]?.[actionKey] ?? item.binding;
    return {
      name: `Purchase ${item.name}`,
      description: item.description,
      type: "purchase",
      itemId: ref.itemId,
      binding,
      goldCost: item.gold,
    };
  };

  // Apply shortcut override to menu itself
  const menuBinding = shortcuts[section]?.[`menu-${config.id}`] ??
    config.binding;

  return {
    name: config.name,
    description: config.description,
    type: "menu",
    icon: config.icon,
    binding: menuBinding,
    actions: config.actions.map(convertActionRef).filter(nonNull),
  };
};
