import { deleteEntity } from "../api/entity.ts";
import { Game } from "../ecs.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const registerDestroyLastFarm = (app: Game) => {
  app.addEventListener("unitEvent", (e) => {
    if (e.abilityId !== "destroyLastFarm" || !e.unit.owner) return;
    const last = findLastPlayerUnit(e.unit.owner, (e) => !!e.tilemap);
    console.log("last", last);
    if (last) deleteEntity(last);
  });
};
