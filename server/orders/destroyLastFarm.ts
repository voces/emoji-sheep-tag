import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const destroyLastFarmOrder = {
  id: "destroyLastFarm",

  // The action data that goes on prefabs
  action: {
    type: "auto" as const,
    order: "destroyLastFarm" as const,
    name: "Destroy Last Farm",
    binding: ["KeyX"],
  },

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
  initiate: (unit: Entity) => {
    if (unit.owner) {
      const lastFarm = findLastPlayerUnit(
        unit.owner,
        (entity) => !!entity.tilemap,
      );
      if (lastFarm) {
        lastFarm.health = 0;
      }
    }
  },
} satisfies OrderDefinition;
