import { SystemEntity } from "jsr:@verit/ecs";
import { app, Entity } from "../ecs.ts";

const circles = new Map<
  SystemEntity<Entity, "unitType" | "modelScale">,
  { birth: number; initialScale: number }
>();

app.addSystem({
  props: ["unitType", "modelScale"],
  onAdd: (e) => {
    if (e.unitType === "circle") {
      circles.set(e, { birth: app.lastUpdate, initialScale: e.modelScale });
    }
  },
  onChange: (e) => {
    if (e.unitType !== "circle") circles.delete(e);
  },
  onRemove: (e) =>
    circles.delete(e as SystemEntity<Entity, "unitType" | "modelScale">),
  update: (_, time) => {
    for (const [circle, { birth, initialScale }] of circles) {
      const next = initialScale - (time * 3 - birth * 3) ** 2;
      if (next < 0.01) app.delete(circle);
      else circle.modelScale = next;
    }
  },
});

export const newCircleIndicator = (
  position: { x: number; y: number },
  { color = "#33dd33", scale = 1 }: { color?: string; scale?: number } = {},
) => {
  app.add({
    id: `circle-${crypto.randomUUID()}`,
    unitType: "circle",
    playerColor: color,
    position,
    modelScale: scale,
  });
};
