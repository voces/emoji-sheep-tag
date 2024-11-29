import { deleteEntity } from "../api/entity.ts";
import { Game, onInit } from "../ecs.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

onInit((game) => {
  game.addEventListener("unitOrder", (e) => {
    if (e.order !== "destroyLastFarm" || !e.unit.owner) return;
    const last = findLastPlayerUnit(e.unit.owner, (e) => !!e.tilemap);
    console.log("last", last);
    if (last) deleteEntity(last);
  });
});
