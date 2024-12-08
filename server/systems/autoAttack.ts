import { SystemEntity } from "jsr:@verit/ecs";
import { onInit } from "../ecs.ts";
import { Entity } from "../../shared/types.ts";
import { getEntitiesInRange } from "./kd.ts";
import { isEnemy } from "../api/unit.ts";
import {
  distanceBetweenEntities,
  distanceBetweenPoints,
} from "../../shared/pathing/math.ts";
import { calcPath } from "./pathing.ts";

onInit((game) => {
  const idleCheck = (e: SystemEntity<Entity, "attack" | "position">) => {
    if (e.action || e.queue?.length) return;
    const nearest = getEntitiesInRange(e.position.x, e.position.y, 10)
      .filter((e2) => isEnemy(e, e2))
      .map((e2) =>
        [e2, distanceBetweenPoints(e.position, e2.position)] as const
      )
      .sort((a, b) => {
        if (a[0].unitType === "sheep") {
          if (b[0].unitType !== "sheep") return -1;
        } else if (b[0].unitType === "sheep") return 1;
        return a[1] - b[1];
      });

    for (const [target] of nearest) {
      if (distanceBetweenEntities(e, target) < e.attack.range) {
        e.action = { type: "attack", target: target.id };
        break;
      }
      const path = calcPath(e, target.id, { mode: "attack" }).slice(1);
      if (
        !path.length || (path[path.length - 1].x === e.position.x &&
          path[path.length - 1].y === e.position.y)
      ) continue;
      e.action = { type: "walk", target: target.id, path, attacking: true };
      e.queue = [{ type: "attack", target: target.id }];
      break;
    }
  };

  let counter = 0;
  const sys = game.addSystem({
    props: ["isIdle", "attack", "position"],
    onAdd: (e) => idleCheck(e),
    update: () => {
      let offset = -1;
      for (const e of sys.entities) {
        if (e.action || e.queue?.length) continue;
        offset++;
        if ((counter + offset) % 17) continue;
        idleCheck(e);
      }
      counter++;
    },
  });
});
