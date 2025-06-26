import { orderAttack as orderAttack } from "../api/unit.ts";
import { onInit } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";

onInit((game) => {
  game.addEventListener("unitOrder", (e) => {
    if (e.order !== "attack" || !e.unit.attack || !e.unit.position) return;

    // Interrupt
    delete e.unit.action;
    delete e.unit.queue;

    const target = typeof e.orderTarget === "string"
      ? lookup(e.orderTarget)
      : e.orderTarget;
    if (!target) return;

    if (!("id" in target)) {
      console.warn("attack-move not yet implemented");
      return;
    }

    orderAttack(e.unit, target);
  });
});
