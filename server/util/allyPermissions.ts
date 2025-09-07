import { Entity, UnitDataAction } from "@/shared/types.ts";
import { Client } from "../client.ts";
import { isAlly } from "@/shared/api/unit.ts";

/**
 * Checks if a client can execute an action on a unit
 * Considers both ownership and ally permissions
 */
export const canExecuteActionOnUnit = (
  client: Client,
  unit: Entity,
  action: UnitDataAction,
): boolean => {
  // Direct ownership always allows action
  if (client.id === unit.owner) return true;

  // If action doesn't allow allies, deny
  if (!action.allowAllies) return false;

  // Check if client and unit are allies using existing ally logic
  return isAlly(client.id, unit);
};
