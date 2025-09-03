import { isAlly } from "@/shared/api/unit.ts";
import { app, Entity, SystemEntity } from "../ecs.ts";
import { getLocalPlayer, getPlayer } from "../ui/vars/players.ts";
import { prefabs as blueprintData } from "@/shared/data.ts";
import { nonNull } from "@/shared/types.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";

const blueprints = new Map<Entity, Entity[]>();

const entitiesFromQueue = (e: SystemEntity<"owner">) => {
  if (!isAlly(e, getLocalPlayer()!.id)) return;
  const buildOrders = [
    e.order?.type === "build" ? e.order : undefined,
    ...e.queue?.filter((a) => a.type === "build") ?? [],
  ].filter(nonNull);

  if (!buildOrders.length) blueprints.delete(e);
  else {
    const playerColor = getPlayer(e.owner)?.color;
    blueprints.set(
      e,
      buildOrders.map((a) =>
        app.addEntity({
          id: `${e.id}-blueprint-${crypto.randomUUID()}`,
          prefab: a?.unitType,
          model: blueprintData[a.unitType]?.model,
          modelScale: blueprintData[a.unitType]?.modelScale,
          owner: e.owner,
          position: { x: a.x, y: a.y },
          vertexColor: playerColor
            ? computeBlueprintColor(playerColor, 0x00ff)
            : 0x00ff,
          alpha: 0.75,
          selectable: false,
        })
      ),
    );
  }
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
