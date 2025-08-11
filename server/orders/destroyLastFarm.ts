import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const destroyLastFarmOrder = {
  id: "destroyLastFarm",

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    // Must have owner
    if (!unit.owner) return false;

    // Must have at least one farm to destroy
    const lastFarm = findLastPlayerUnit(
      unit.owner,
      (entity) => !!entity.tilemap,
    );
    return !!lastFarm;
  },

  // Called when the order is initiated (immediately destroy the farm without interrupting current orders)
  onIssue: (unit: Entity) => {
    if (!unit.owner) return "failed";
    const lastFarm = findLastPlayerUnit(
      unit.owner,
      (entity) => !!entity.tilemap,
    );
    if (lastFarm) {
      lastFarm.lastAttacker = null;
      lastFarm.health = 0;
    }
    return "immediate";
  },
} satisfies OrderDefinition;
