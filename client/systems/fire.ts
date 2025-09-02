import { isStructure } from "@/shared/api/unit.ts";
import { app, Entity } from "../ecs.ts";

const fires = new WeakMap<Entity, Entity[]>();

const getFires = (entity: Entity) => {
  if ((entity.health ?? 0) <= 0) return 0;
  return 3 -
    Math.min(
      Math.round(((entity.health ?? 0) / (entity.maxHealth ?? 1)) * 3),
      3,
    );
};

const fireOffsets = [
  { x: 0.2, y: 0.1 },
  { x: -0.2, y: -0.15 },
  { x: -0.15, y: 0.30 },
];

const updateFires = (e: Entity, remove = false) => {
  if (!isStructure(e)) return;
  const fireCount = remove ? 0 : getFires(e);
  let existing = fires.get(e);
  if (!existing) {
    if (fireCount === 0) return;
    existing = [];
    fires.set(e, existing);
  }
  if (e.position) {
    for (let i = existing.length; i < fireCount; i++) {
      const fire = app.addEntity({
        id: `fire-${crypto.randomUUID()}`,
        prefab: "fire",
        position: {
          x: e.position.x + fireOffsets[i].x,
          y: e.position.y + fireOffsets[i].y,
        },
        zIndex: 0.2 + i * 0.01,
      });
      existing.push(fire);
    }
  }
  for (let i = fireCount; i < existing.length; i++) {
    app.removeEntity(existing[i]);
  }
  if (fireCount === 0) fires.delete(e);
  else existing.splice(fireCount);
};

app.addSystem({
  props: ["health", "maxHealth"],
  onAdd: updateFires,
  onChange: updateFires,
  onRemove: (e) => updateFires(e, true),
});
