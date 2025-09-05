import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const destroyLastFarmOrder = {
  id: "destroyLastFarm",

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    if (!unit.owner) return false;
    return true;
  },

  // Called when the order is initiated (immediately destroy the farm without interrupting current orders)
  onIssue: (unit: Entity, _, queue) => {
    if (!unit.owner) return "failed";
    if (queue) {
      unit.queue = [...unit.queue ?? [], {
        type: "cast",
        orderId: "destroyLastFarm",
        remaining: 0,
      }];
      return "incomplete";
    }
    return "done";
  },

  onCastComplete: (unit: Entity) => {
    if (!unit.owner) return false;
    const lastFarm = findLastPlayerUnit(
      unit.owner,
      (entity) => !!entity.tilemap,
    );
    if (lastFarm) {
      lastFarm.lastAttacker = null;
      lastFarm.health = 0;
    }
    return true;
  },
} satisfies OrderDefinition;
