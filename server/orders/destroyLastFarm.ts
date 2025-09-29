import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { isStructure } from "@/shared/api/unit.ts";

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
      return "ordered";
    }
    return "immediate";
  },

  onCastComplete: (unit: Entity) => {
    if (!unit.owner) return false;
    const lastFarm = findLastPlayerUnit(
      unit.owner,
      (entity) => !!entity.position && isStructure(entity),
    );
    if (lastFarm) {
      lastFarm.lastAttacker = null;
      if (typeof lastFarm.health === "number") lastFarm.health = 0;
      removeEntity(lastFarm);
    }
    return true;
  },
} satisfies OrderDefinition;
