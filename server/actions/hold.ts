import { onInit } from "../ecs.ts";

onInit((game) => {
  game.addEventListener("unitOrder", (e) => {
    if (e.order !== "hold" || !e.unit.owner) return;
    delete e.unit.queue;
    e.unit.action = { type: "hold" };
  });
});
