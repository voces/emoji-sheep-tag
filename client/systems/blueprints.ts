import { SystemEntity } from "https://jsr.io/@verit/ecs/0.6.1/src/System.ts";
import { app, Entity } from "../ecs.ts";
import { isLocalPlayer } from "../ui/vars/players.ts";

const blueprints = new Map<Entity, Entity[]>();

const entitiesFromQueue = (e: SystemEntity<Entity, "queue" | "owner">) =>
  isLocalPlayer(e.owner) &&
  blueprints.set(
    e,
    e.queue.filter((a) => a.type === "build").map((a) =>
      app.add({
        id: `${e.id}-blueprint-${crypto.randomUUID()}`,
        unitType: a.unitType,
        owner: e.owner,
        position: { x: a.x, y: a.y },
        blueprint: true,
      })
    ),
  );

app.addSystem({
  props: ["queue", "owner"],
  onAdd: (e) => entitiesFromQueue(e),
  onChange: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.delete(e));
    entitiesFromQueue(e);
  },
  onRemove: (e) => {
    const existing = blueprints.get(e);
    if (existing) existing.forEach((e) => app.delete(e));
  },
});
