import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { Entity, SystemEntity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";

const swings = new Map<Entity, Entity>();

const updateSwing = (e: SystemEntity<"swing">) => {
  const existing = swings.get(e);
  if (existing) removeEntity(existing);

  // Only render swing if there's no projectile and attack has a model
  if (!e.attack?.model || e.attack.projectileSpeed) return;

  const direction = Math.atan2(
    e.swing.target.y - e.swing.source.y,
    e.swing.target.x - e.swing.source.x,
  );

  const swing = addEntity({
    id: `swing-${crypto.randomUUID()}`,
    prefab: e.attack.model,
    position: {
      x: e.swing.source.x + 0.75 * Math.cos(direction),
      y: e.swing.source.y + 0.75 * Math.sin(direction),
    },
    facing: direction + Math.PI,
    isDoodad: true,
  });
  swings.set(e, swing);
};

addSystem({
  props: ["swing"],
  onAdd: updateSwing,
  onChange: updateSwing,
  onRemove: (e) => {
    const swing = swings.get(e);
    if (!swing) return;
    removeEntity(swing);
    swings.delete(e);
  },
});
