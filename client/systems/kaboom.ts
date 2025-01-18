import { app } from "../ecs.ts";

app.addSystem({
  props: ["health", "tilemap", "position"],
  onRemove: (e) => {
    if (!e.position) return;

    const kaboom = app.add({
      id: `kaboom-${crypto.randomUUID()}`,
      unitType: "collision",
      position: { x: e.position.x, y: e.position.y },
      facing: Math.random() * Math.PI * 2,
      modelScale: Math.max(e.tilemap?.width ?? 0, e.tilemap?.height ?? 0) / 4 +
        0.25,
    });
    setTimeout(() => {
      app.delete(kaboom);
    }, 200);
  },
});
