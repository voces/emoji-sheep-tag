import { isAlly } from "@/shared/api/unit.ts";
import { app, Entity } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { prefabs as blueprintData } from "@/shared/data.ts";
import { nonNull } from "@/shared/types.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";
import { lookup } from "./lookup.ts";
import { id } from "@/shared/util/id.ts";

const blueprints = new Map<Entity, Entity[]>();

const clearBlueprints = (e: Entity) => {
  const existing = blueprints.get(e);
  if (!existing) return;

  for (const blueprint of existing) app.removeEntity(blueprint);
  blueprints.delete(e);
};

const entitiesFromQueue = (e: Entity) => {
  if (!isAlly(e, getLocalPlayer()!.id) || !e.owner || !app.entities.has(e)) {
    return clearBlueprints(e);
  }

  const orders = [...(e.queue ?? [])];
  if (e.order && (e.order.type === "build" || e.queue)) orders.unshift(e.order);

  const playerColor = getPlayer(e.owner)?.playerColor;

  const existingBlueprints = blueprints.get(e) ?? [];

  const orderEntities = orders.map((o): Entity | undefined => {
    if (o.type === "build") {
      const existing = existingBlueprints.find((b) =>
        b.position?.x === o.x && b.position?.y === o.y &&
        (b.prefab === o.unitType && b.model === blueprintData[o.unitType].model)
      );
      if (existing) return existing;

      return app.addEntity({
        id: id(`${e.id}-blueprint`),
        prefab: o?.unitType,
        model: blueprintData[o.unitType]?.model,
        modelScale: blueprintData[o.unitType]?.modelScale,
        owner: e.owner,
        position: { x: o.x, y: o.y },
        vertexColor: playerColor
          ? computeBlueprintColor(playerColor, 0x0000ff)
          : 0x0000ff,
        alpha: 0.75,
        isDoodad: true,
      });
    }
    if ("target" in o && o.target) {
      const existing = existingBlueprints.find((b) =>
        b.position?.x === o.target?.x && b.position?.y === o.target?.y &&
        b.model === "flag"
      );
      if (existing) return existing;
      return app.addEntity({
        id: id(`${e.id}-blueprint`),
        model: "flag",
        owner: e.owner,
        position: { x: o.target.x, y: o.target.y },
        isDoodad: true,
      });
    }
    if ("targetId" in o && o.targetId) {
      const target = lookup[o.targetId];
      if (target && target.position) {
        const existing = existingBlueprints.find((b) =>
          b.position?.x === target.position?.x &&
          b.position?.y === target.position?.y &&
          b.model === "flag"
        );
        if (existing) return existing;
        return app.addEntity({
          id: id(`${e.id}-blueprint`),
          model: "flag",
          owner: e.owner,
          position: { x: target.position.x, y: target.position.y },
          isDoodad: true,
        });
      }
    }
  }).filter(nonNull);

  for (const blueprint of existingBlueprints) {
    if (!orderEntities.includes(blueprint)) app.removeEntity(blueprint);
  }

  if (!orderEntities.length) blueprints.delete(e);
  else blueprints.set(e, orderEntities);
};

app.addSystem({
  props: ["order", "owner"],
  onAdd: entitiesFromQueue,
  onChange: entitiesFromQueue,
  onRemove: entitiesFromQueue,
});

app.addSystem({
  props: ["queue", "owner"],
  onAdd: entitiesFromQueue,
  onChange: entitiesFromQueue,
  onRemove: entitiesFromQueue,
});
