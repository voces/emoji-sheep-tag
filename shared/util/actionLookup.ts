import { Entity, Item, UnitDataAction } from "@/shared/types.ts";

export type ActionMatcher = (action: UnitDataAction) => boolean;

/**
 * Iterates through all actions of an entity including:
 * 1. Entity.actions (base unit actions)
 * 2. Entity.actions[].actions (submenu actions)
 * 3. Entity.inventory[].actions (item actions)
 *
 * Calls the callback for each action found.
 */
export function* iterateActions(entity: Entity): Generator<UnitDataAction> {
  // Iterate through unit's base actions
  if (entity.actions) {
    for (const action of entity.actions) {
      yield action;

      // Check submenu actions
      if (action.type === "menu" && action.actions) {
        for (const subAction of action.actions) {
          yield subAction;
        }
      }
    }
  }

  // Iterate through item actions (skip for mirror images)
  if (entity.inventory && !entity.isMirror) {
    for (const item of entity.inventory) {
      if (item.actions && (item.charges === undefined || item.charges > 0)) {
        for (const itemAction of item.actions) {
          yield itemAction;
        }
      }
    }
  }
}

/**
 * Finds the first action matching the given predicate
 */
export function findAction<T extends UnitDataAction>(
  entity: Entity,
  matcher: (action: UnitDataAction) => action is T,
): T | undefined;
export function findAction(
  entity: Entity,
  matcher: ActionMatcher,
): UnitDataAction | undefined;
export function findAction(
  entity: Entity,
  matcher: ActionMatcher,
): UnitDataAction | undefined {
  for (const action of iterateActions(entity)) {
    if (matcher(action)) return action;
  }
  return undefined;
}

/**
 * Checks if entity has an action matching the given predicate
 */
export const hasAction = (entity: Entity, matcher: ActionMatcher): boolean =>
  findAction(entity, matcher) !== undefined;

/**
 * Get the order identifier from an action.
 * Returns the field that identifies which order this action triggers.
 */
export const getActionOrderId = (
  action: UnitDataAction,
): string | undefined => {
  switch (action.type) {
    case "target":
    case "auto":
      return action.order;
    case "upgrade":
      return action.prefab;
    case "build":
      return `build${action.unitType[0].toUpperCase()}${
        action.unitType.slice(1)
      }`;
    case "purchase":
      return `buy${action.itemId[0].toUpperCase()}${action.itemId.slice(1)}`;
    case "menu":
      return undefined;
  }
};

/**
 * Get the order identifier from an entity's current order.
 */
const getEntityOrderId = (entity: Entity): string | undefined => {
  const order = entity.order;
  if (!order) return undefined;

  switch (order.type) {
    case "cast":
      return order.orderId;
    case "build":
      return order.unitType;
    case "upgrade":
      return order.prefab;
    default:
      return undefined;
  }
};

/**
 * Convenience function to find an action by order identifier.
 * If order is not provided, uses the entity's current order.
 */
export const findActionByOrder = (
  entity: Entity,
  order?: string,
): UnitDataAction | undefined => {
  const orderId = order ?? getEntityOrderId(entity);
  if (!orderId) return undefined;

  return findAction(entity, (action) => getActionOrderId(action) === orderId);
};

/**
 * Iterates through all actions of an entity along with their containing item (if applicable).
 */
export function* iterateActionsWithItem(
  entity: Entity,
): Generator<{ action: UnitDataAction; item?: Item }> {
  // Iterate through unit's base actions
  if (entity.actions) {
    for (const action of entity.actions) {
      yield { action };

      // Check submenu actions
      if (action.type === "menu" && action.actions) {
        for (const subAction of action.actions) {
          yield { action: subAction };
        }
      }
    }
  }

  // Iterate through item actions (skip for mirror images)
  if (entity.inventory && !entity.isMirror) {
    for (const item of entity.inventory) {
      if (item.actions && (item.charges === undefined || item.charges > 0)) {
        for (const itemAction of item.actions) {
          yield { action: itemAction, item };
        }
      }
    }
  }
}

/**
 * Finds an action by order and also returns the item containing it (if applicable).
 * Useful for charge consumption logic.
 * If order is not provided, uses the entity's current order.
 */
export const findActionAndItem = (
  entity: Entity,
  order?: string,
): { action: UnitDataAction; item?: Item } | undefined => {
  const orderId = order ?? getEntityOrderId(entity);
  if (!orderId) return undefined;

  for (const entry of iterateActionsWithItem(entity)) {
    if (getActionOrderId(entry.action) === orderId) {
      return entry;
    }
  }
  return undefined;
};
