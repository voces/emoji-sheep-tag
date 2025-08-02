import { SystemEntity } from "jsr:@verit/ecs";
import { onInit } from "../ecs.ts";
import { Entity } from "../../shared/types.ts";
import { acquireTarget, orderAttack } from "../api/unit.ts";

onInit((game) => {
  const idleCheck = (e: SystemEntity<Entity, "attack" | "position">) => {
    if (e.action || e.queue?.length) return;

    const target = acquireTarget(e);
    // TODO: return to pos?
    if (target) orderAttack(e, target);
  };

  let counter = 0;
  const sys = game.addSystem({
    props: ["attack", "position"],
    onAdd: (e) => idleCheck(e),
    update: () => {
      let offset = -1;
      for (const e of sys.entities) {
        offset++;
        if ((counter + offset) % 17) continue;
        idleCheck(e);
      }
      counter++;
    },
  });
});
