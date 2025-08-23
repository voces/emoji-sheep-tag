import { Entity, UnitDataAction } from "@/shared/types.ts";

export type ActionMatcher = (action: UnitDataAction) => boolean;

/**
 * Iterates through all actions of an entity including:
 * 1. Entity.actions (base unit actions)
 * 2. Entity.inventory[].actions (item actions)
 * 3. Entity.actions[].actions (submenu actions)
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
export function findAction(
  entity: Entity,
  matcher: ActionMatcher,
): UnitDataAction | undefined {
  for (const action of iterateActions(entity)) {
    if (matcher(action)) {
      return action;
    }
  }
  return undefined;
}

/**
 * Checks if entity has an action matching the given predicate
 */
export function hasAction(
  entity: Entity,
  matcher: ActionMatcher,
): boolean {
  return findAction(entity, matcher) !== undefined;
}
