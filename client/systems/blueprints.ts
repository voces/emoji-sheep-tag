import { isAlly } from "@/shared/api/unit.ts";
import { app, Entity, SystemEntity } from "../ecs.ts";
import { getLocalPlayer, getPlayer } from "../ui/vars/players.ts";
import { prefabs as blueprintData } from "@/shared/data.ts";
import { nonNull } from "@/shared/types.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";
import { lookup } from "./lookup.ts";

const blueprints = new Map<Entity, Entity[]>();

const entitiesFromQueue = (e: SystemEntity<"owner">) => {
  if (!isAlly(e, getLocalPlayer()!.id)) return;

  const orders = [...(e.queue ?? [])];
  if (e.order && (e.order.type === "build" || e.queue)) orders.unshift(e.order);

  const playerColor = getPlayer(e.owner)?.color;

  const orderEntities = orders.map((o) => {
    if (o.type === "build") {
      return app.addEntity({
        id: `${e.id}-blueprint-${crypto.randomUUID()}`,
        prefab: o?.unitType,
        model: blueprintData[o.unitType]?.model,
        modelScale: blueprintData[o.unitType]?.modelScale,
        owner: e.owner,
        position: { x: o.x, y: o.y },
        vertexColor: playerColor
          ? computeBlueprintColor(playerColor, 0x00ff)
          : 0x00ff,
        alpha: 0.75,
        selectable: false,
      });
    }
    if ("target" in o && o.target) {
      return app.addEntity({
        id: `${e.id}-blueprint-${crypto.randomUUID()}`,
        model: "flag",
        owner: e.owner,
        position: { x: o.target.x, y: o.target.y },
        selectable: false,
      });
    }
    if ("targetId" in o && o.targetId) {
      const target = lookup[o.targetId];
      if (target && target.position) {
        return app.addEntity({
          id: `${e.id}-blueprint-${crypto.randomUUID()}`,
          model: "flag",
          owner: e.owner,
          position: { x: target.position.x, y: target.position.y },
          selectable: false,
        });
      }
    }
  }).filter(nonNull);

  if (!orderEntities.length) blueprints.delete(e);

  for (const blueprint of blueprints.get(e) ?? []) app.removeEntity(blueprint);

  blueprints.set(e, orderEntities);
};

app.addSystem({
  props: ["order", "owner"],
  onAdd: (e) => entitiesFromQueue(e),
  onChange: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.removeEntity(e));
    entitiesFromQueue(e);
  },
  onRemove: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.removeEntity(e));
  },
});

app.addSystem({
  props: ["queue", "owner"],
  onAdd: (e) => entitiesFromQueue(e),
  onChange: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.removeEntity(e));
    entitiesFromQueue(e);
  },
  onRemove: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.removeEntity(e));
  },
});
