import { app, Entity, SystemEntity } from "../ecs.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";
import { isAlly } from "../api/unit.ts";
import { prefabs as blueprintData } from "@/shared/data.ts";
import { nonNull } from "@/shared/types.ts";

const blueprints = new Map<Entity, Entity[]>();

const entitiesFromQueue = (e: SystemEntity<"owner">) => {
  if (!isAlly(e, getLocalPlayer()!)) return;
  const buildOrders = [
    e.order?.type === "build" ? e.order : undefined,
    ...e.queue?.filter((a) => a.type === "build") ?? [],
  ].filter(nonNull);

  if (!buildOrders.length) blueprints.delete(e);
  else {blueprints.set(
      e,
      buildOrders.map((a) =>
        app.addEntity({
          id: `${e.id}-blueprint-${crypto.randomUUID()}`,
          prefab: a?.unitType,
          model: blueprintData[a.unitType]?.model,
          modelScale: blueprintData[a.unitType]?.modelScale,
          owner: e.owner,
          position: { x: a.x, y: a.y },
          blueprint: 0x00ff,
          selectable: false,
        })
      ),
    );}
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
