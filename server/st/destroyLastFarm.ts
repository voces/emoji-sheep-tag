import { Entity } from "../../shared/types.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const handleDestroyLastFarm = (unit: Entity) => {
  if (!unit.owner) return;
  const last = findLastPlayerUnit(unit.owner, (e) => !!e.tilemap);
  if (last) last.health = 0;
};
