import { Entity, UnitDataAction } from "@/shared/types.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { editorVar } from "@/vars/editor.ts";

/**
 * Checks if a player can execute an action on a unit
 * Considers both ownership and ally permissions
 */
export const canPlayerExecuteAction = (
  playerId: string,
  unit: Entity,
  action: UnitDataAction,
): boolean => {
  if (editorVar()) return true;

  // Direct ownership always allows action
  if (playerId === unit.owner) return true;

  // If action doesn't allow allies, deny
  if (!action.allowAllies) return false;

  // Check if player and unit are allies using existing ally logic
  return isAlly(playerId, unit);
};

/**
 * Checks if any actions in a unit's action list are available to allies
 */
export const hasAllyActions = (unit: Entity): boolean => {
  if (!unit.actions) return false;
  return unit.actions.some((action) => action.allowAllies);
};

/**
 * Filters actions to only those the player can execute
 */
export const getExecutableActions = (
  playerId: string,
  unit: Entity,
  actions: readonly UnitDataAction[],
): UnitDataAction[] =>
  actions.filter((action) => canPlayerExecuteAction(playerId, unit, action));
