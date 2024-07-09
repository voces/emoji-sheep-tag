import { mouse } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";

mouse.addEventListener("mouseButtonDown", (e) => {
  if (e.button !== "right") return;
  send({
    type: "move",
    units: Array.from(app.entities, (e) => e.id).filter(<T>(
      v: T | undefined,
    ): v is T => !!v),
    x: e.world.x,
    y: e.world.y,
  });
});

globalThis.addEventListener("keydown", (e) => {
  if (e.code === "KeyF") {
  }
});
