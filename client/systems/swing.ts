import { SystemEntity } from "jsr:@verit/ecs";
import { app, Entity } from "../ecs.ts";

const swings = new WeakMap<Entity, Entity>();

const updateSwing = (e: SystemEntity<Entity, "swing">) => {
  const existing = swings.get(e);
  if (existing) app.delete(existing);

  const direction = Math.atan2(
    e.swing.target.y - e.swing.source.y,
    e.swing.target.x - e.swing.source.x,
  );

  const swing = app.add({
    id: `swing-${crypto.randomUUID()}`,
    unitType: "claw",
    position: {
      x: e.swing.source.x + 0.75 * Math.cos(direction),
      y: e.swing.source.y + 0.75 * Math.sin(direction),
    },
    facing: direction + Math.PI,
    zIndex: 0.25,
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
    app.delete(swing);
    swings.delete(e);
  },
});
