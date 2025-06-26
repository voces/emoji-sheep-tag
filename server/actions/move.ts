import { orderMove } from "../api/unit.ts";
import { onInit } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";

onInit((game) => {
  game.addEventListener("unitOrder", (e) => {
    if (e.order !== "move" || !e.unit.position) return;

    // Interrupt
    delete e.unit.action;
    delete e.unit.queue;

    const target = typeof e.orderTarget === "string"
      ? lookup(e.orderTarget)
      : e.orderTarget;
    if (!target) return;

    orderMove(e.unit, target);
  });
});
