import { SystemEntity } from "https://jsr.io/@verit/ecs/0.6.1/src/System.ts";
import { app, Entity } from "../ecs.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";
import { isAlly } from "../api/unit.ts";
import { unitData } from "../../shared/data.ts";

const blueprints = new Map<Entity, Entity[]>();

const entitiesFromQueue = (e: SystemEntity<Entity, "queue" | "owner">) =>
  isAlly(e, getLocalPlayer()!) &&
  blueprints.set(
    e,
    e.queue.filter((a) => a.type === "build").map((a) =>
      app.addEntity({
        id: `${e.id}-blueprint-${crypto.randomUUID()}`,
        unitType: a.unitType,
        model: unitData[a.unitType]?.model,
        modelScale: unitData[a.unitType]?.modelScale,
        owner: e.owner,
        position: { x: a.x, y: a.y },
        blueprint: 0x00ff,
      })
    ),
  );

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
