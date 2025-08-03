import { app } from "../ecs.ts";

app.addSystem({
  props: ["health", "tilemap", "position"],
  onRemove: (e) => {
    if (!e.position) return;

    app.addEntity({
      id: `kaboom-${crypto.randomUUID()}`,
      prefab: "collision",
      position: { x: e.position.x, y: e.position.y },
      facing: Math.random() * Math.PI * 2,
      modelScale: Math.max(e.tilemap?.width ?? 0, e.tilemap?.height ?? 0) / 4 +
        0.25,
      isKaboom: true,
      progress: 1,
    });
  },
});

app.addSystem({
  props: ["isKaboom", "progress"],
  updateEntity: (e, delta) => {
    if (e.progress < 0.01) return app.removeEntity(e);
    e.progress -= delta * 5;
  },
});
