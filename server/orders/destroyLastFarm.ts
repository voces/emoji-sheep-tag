import { OrderOverride } from "./types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { refundEntity } from "../api/unit.ts";

export const destroyLastFarmOrder = {
  canExecute: (unit) => !!unit.owner,

  onCastComplete: (unit) => {
    if (!unit.owner) return false;
    const lastFarm = findLastPlayerUnit(
      unit.owner,
      (entity) => !!entity.position && isStructure(entity),
    );
    if (lastFarm) {
      refundEntity(lastFarm);
      lastFarm.lastAttacker = null;
      if (typeof lastFarm.health === "number") lastFarm.health = 0;
      removeEntity(lastFarm);
    }
    return true;
  },
} satisfies OrderOverride;
