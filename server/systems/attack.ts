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
        return console.debug("bad action or position", e.action, e.position);
      }

      if (!e.attack) {
        delete e.action;
        delete (e as Entity).isAttacking;
        if (e.swing) delete e.swing;
        return console.debug("bad attack");
      }

      const target = lookup(e.action.target);

      if (!target || !target.position || target.health === 0) {
        delete e.action;
        delete (e as Entity).isAttacking;
        if (e.swing) delete e.swing;
        return console.debug("bad target");
      }

      if (e.swing) {
        const d = distanceBetweenPoints(target.position, e.swing.target) >
          e.attack.rangeMotionBuffer;
        if (e.attack.rangeMotionBuffer > 0 && d) {
          delete e.swing;
        } else if (e.swing.time + e.attack.damagePoint <= time) {
          console.debug(time, "hit");
          delete e.swing;
          e.lastAttack = time;
          if (target.health) {
            target.health = Math.max(0, target.health - e.attack.damage);
            console.debug("now at", target.health, "health");
            if (target.health === 0) {
              app.dispatchTypedEvent(
                "unitDeath",
                new UnitDeathEvent(target, e),
              );
            }
          } else console.debug("no health?", target.health);
        }
        return; //console.debug("swinging", d, e.attack.rangeMotionBuffer);
      }

      if (distanceBetweenEntities(e, target) > e.attack.range) {
        if ((counter + offset) % 17 > 0) return;
        console.debug(
          "attack system calc path",
          distanceBetweenEntities(e, target),
        );
        const path = calcPath(e, e.action.target, "attack");
        if (!path.length) {
          delete e.action;
          delete (e as Entity).isAttacking;
          return console.debug("unpathable");
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
        return console.debug(
          "repathed",
          distanceBetweenEntities(e, target),
          {
            position: e.position,
            path,
            target,
            range: e.attack.range,
          },
          target.position,
          e.radius,
          target.radius,
        );
      }

      if ((e.lastAttack ?? 0) + e.attack.cooldown <= time) {
        console.debug(time, "swing", distanceBetweenEntities(e, target));
        e.swing = { time, source: e.position, target: target.position };
      } //else console.debug("cooldown");
    },
  });
};
