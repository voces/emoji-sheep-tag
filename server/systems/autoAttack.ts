import { SystemEntity } from "jsr:@verit/ecs";
import { addSystem } from "../ecs.ts";
import { Entity } from "../../shared/types.ts";
import { acquireTarget, orderAttack } from "../api/unit.ts";

addSystem(() => {
  const idleCheck = (e: SystemEntity<Entity, "attack" | "position">) => {
    if (e.order || e.queue?.length) return;

    const target = acquireTarget(e);
    // TODO: return to pos?
    if (target) orderAttack(e, target);
  };

  const entities = new Set<SystemEntity<Entity, "attack" | "position">>();
  let counter = 0;

  return {
    props: ["attack", "position"],
    entities,
    onAdd: (e) => idleCheck(e),
    update: () => {
      let offset = -1;
      for (const e of entities) {
        offset++;
        if ((counter + offset) % 17) continue;
        idleCheck(e);
      }
      counter++;
    },
  };
});
