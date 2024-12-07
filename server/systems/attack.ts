import { distanceBetweenPoints } from "../../shared/pathing/math.ts";
import { distanceBetweenEntities } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { Game, UnitDeathEvent } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { calcPath } from "./pathing.ts";

export const addAttackSystem = (app: Game) => {
  let counter = 0;
  let offset = -1;
  app.addSystem({
    props: ["isAttacking"],
    update: () => offset = -1,
    updateChild: (e, _, time) => {
      offset++;

      if (e.action?.type !== "attack" || !e.position) {
        delete (e as Entity).isAttacking;
        if (e.swing) delete e.swing;
        return;
      }

      if (!e.attack) {
        delete e.action;
        delete (e as Entity).isAttacking;
        if (e.swing) delete e.swing;
        return;
      }

      const target = lookup(e.action.target);

      if (!target || !target.position || target.health === 0) {
        delete e.action;
        delete (e as Entity).isAttacking;
        if (e.swing) delete e.swing;
        return;
      }

      if (e.swing) {
        if (
          e.attack.rangeMotionBuffer > 0 &&
          distanceBetweenPoints(target.position, e.swing.target) >
            e.attack.rangeMotionBuffer
        ) delete e.swing;
        else if (e.swing.time + e.attack.damagePoint <= time) {
          delete e.swing;
          e.lastAttack = time;
          if (target.health) {
            target.health = Math.max(0, target.health - e.attack.damage);
            if (target.health === 0) {
              app.dispatchTypedEvent(
                "unitDeath",
                new UnitDeathEvent(target, e),
              );
            }
          }
        }
        return;
      }

      if (
        distanceBetweenEntities(e, target) >
          e.attack.range +
            (target.isMoving ? e.attack.rangeMotionBuffer * 0.1 : 0)
      ) {
        if ((counter + offset) % 17 > 0) return;
        const path = calcPath(e, e.action.target, { mode: "attack" }).slice(1);
        if (
          !path.length ||
          (path[path.length - 1].x === e.position.x &&
            path[path.length - 1].y === e.position.y)
        ) {
          delete (e as Entity).isAttacking;
          delete e.action;
          return;
        }
        e.queue = [e.action, ...(e.queue ?? [])];
        delete (e as Entity).isAttacking;
        e.action = {
          type: "walk",
          target: e.action.target,
          distanceFromTarget: e.attack.range,
          path,
          attacking: true,
        };
        return;
      }

      if ((e.lastAttack ?? 0) + e.attack.cooldown <= time) {
        e.swing = { time, source: e.position, target: target.position };
      }
    },
  });
};
