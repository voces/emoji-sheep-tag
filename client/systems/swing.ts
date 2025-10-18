import { app, Entity, SystemEntity } from "../ecs.ts";

const swings = new Map<Entity, Entity>();

const updateSwing = (e: SystemEntity<"swing">) => {
  const existing = swings.get(e);
  if (existing) app.removeEntity(existing);

  // Only render swing if there's no projectile and attack has a model
  if (!e.attack?.model || e.attack.projectileSpeed) return;

  const direction = Math.atan2(
    e.swing.target.y - e.swing.source.y,
    e.swing.target.x - e.swing.source.x,
  );

  const swing = app.addEntity({
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

app.addSystem({
  props: ["swing"],
  onAdd: updateSwing,
  onChange: updateSwing,
  onRemove: (e) => {
    const swing = swings.get(e);
    if (!swing) return;
    app.removeEntity(swing);
    swings.delete(e);
  },
});
