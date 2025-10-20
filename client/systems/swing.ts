import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { Entity, SystemEntity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";

const swings = new Map<Entity, Entity>();

const updateSwing = (e: SystemEntity<"swing">) => {
  const direction = Math.atan2(
    e.swing.target.y - e.swing.source.y,
    e.swing.target.x - e.swing.source.x,
  );

  const x = e.swing.source.x + 0.75 * Math.cos(direction);
  const y = e.swing.source.y + 0.75 * Math.sin(direction);

  const existing = swings.get(e);
  if (existing) {
    if (
      existing.position?.x === x && existing.position?.y === y &&
      e.attack?.model && !e.attack.projectileSpeed
    ) return;
    removeEntity(existing);
  }

  // Only render swing if there's no projectile and attack has a model
  if (!e.attack?.model || e.attack.projectileSpeed) return;

  const swing = addEntity({
    model: e.attack.model,
    position: { x, y },
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
