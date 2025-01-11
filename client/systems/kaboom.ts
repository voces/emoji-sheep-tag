import { app } from "../ecs.ts";

app.addSystem({
  props: ["health", "tilemap", "position"],
  onRemove: (e) => {
    if (!e.position) return;
    const kaboom = app.add({
      id: `kaboom-${crypto.randomUUID()}`,
      unitType: "collision",
      position: { x: e.position.x, y: e.position.y },
      zIndex: -0.001,
      facing: Math.random() * Math.PI * 2,
    });
    setTimeout(() => {
      app.delete(kaboom);
    }, 200);
  },
});
