import { Entity, UnitDataAction, Item } from "../../shared/types.ts";

export type ActionMatcher = (action: UnitDataAction) => boolean;

/**
 * Finds the first action matching the given predicate by searching through:
 * 1. Entity.actions (base unit actions)
 * 2. Entity.inventory[].action (item actions)
 * 3. Entity.actions[].actions (submenu actions)
 */
export function findAction(
  entity: Entity,
  matcher: ActionMatcher
): UnitDataAction | undefined {
  // Check unit's base actions
  if (entity.actions) {
    for (const action of entity.actions) {
      if (matcher(action)) {
        return action;
      }
    }

    // Check submenu actions
    for (const action of entity.actions) {
      if (action.type === "menu" && action.actions) {
        for (const subAction of action.actions) {
          if (matcher(subAction)) {
            return subAction;
          }
        }
      }
    }
  }

  // Check item actions
  if (entity.inventory) {
    for (const item of entity.inventory) {
      if (item.action && matcher(item.action)) {
        // Only return if item has charges available
        if (item.charges === undefined || item.charges > 0) {
          return item.action;
        }
      }
    }
  }

  return undefined;
}

/**
 * Convenience function to find an action by order (for auto and target actions)
 */
export function findActionByOrder(
  entity: Entity,
  order: string
): UnitDataAction | undefined {
  return findAction(entity, (action) =>
    (action.type === "auto" && action.order === order) ||
    (action.type === "target" && action.order === order)
  );
}

/**
 * Finds an action by order and also returns the item containing it (if applicable)
 * Useful for charge consumption logic
 */
export function findActionAndItem(
  entity: Entity,
  order: string
): { action: UnitDataAction; item?: Item } | undefined {
  // Check unit's base actions first
  if (entity.actions) {
    for (const action of entity.actions) {
      if (
        (action.type === "auto" && action.order === order) ||
        (action.type === "target" && action.order === order)
      ) {
        return { action };
      }
    }

    // Check submenu actions
    for (const action of entity.actions) {
      if (action.type === "menu" && action.actions) {
        for (const subAction of action.actions) {
          if (
            (subAction.type === "auto" && subAction.order === order) ||
            (subAction.type === "target" && subAction.order === order)
          ) {
            return { action: subAction };
          }
        }
      }
    }
  }

  // Check item actions
  if (entity.inventory) {
    for (const item of entity.inventory) {
      if (
        item.action &&
        ((item.action.type === "auto" && item.action.order === order) ||
         (item.action.type === "target" && item.action.order === order))
      ) {
        if (item.charges === undefined || item.charges > 0) {
          return { action: item.action, item };
        }
      }
    }
  }

  return undefined;
}