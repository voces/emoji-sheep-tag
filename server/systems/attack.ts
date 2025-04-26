import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { distanceBetweenEntities } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { Game } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { calcPath } from "./pathing.ts";

let damageSource: Entity | undefined;
const withDamageSource = <T>(e: Entity, fn: () => T) => {
  const prev = damageSource;
  damageSource = e;
  try {
    return fn();
  } finally {
    damageSource = prev;
  }
};
export const getDamageSource = () => damageSource;

export const addAttackSystem = (app: Game) => {
  let counter = 0;
  let offset = -1;
  app.addSystem({
    props: ["isAttacking"],
    update: () => {
      offset = -1;
      counter++;
    },
    updateEntity: (e, delta, time) => {
      offset++;

      if (e.action?.type !== "attack" || !e.position) {
        if (e.swing) delete e.swing;
        delete (e as Entity).isAttacking;
        return;
      }

      if (!e.attack) {
        if (e.swing) delete e.swing;
        delete (e as Entity).isAttacking;
        delete e.action;
        return;
      }

      const target = lookup(e.action.target);

      if (!target || !target.position || target.health === 0) {
        if (e.swing) delete e.swing;
        delete (e as Entity).isAttacking;
        delete e.action;
        return;
      }

      if (e.swing) {
        // Abort if target too far before backswing
        if (
          e.swing.time + e.attack.backswing > time &&
          e.attack.rangeMotionBuffer > 0 &&
          distanceBetweenPoints(target.position, e.swing.target) >
            e.attack.rangeMotionBuffer
        ) return delete e.swing;

        // TODO: add mid-swing turning; if not ±60°, delay swing by that amount

        // Swing if damage point reached
        if (e.swing.time + e.attack.damagePoint <= time) {
          const swingTarget = e.swing.target;
          e.lastAttack = time;
          delete e.swing;

          // Miss if target too far
          if (
            e.attack.rangeMotionBuffer > 0 &&
            distanceBetweenPoints(target.position, swingTarget) >
              e.attack.rangeMotionBuffer
          ) return;

          // Otherwise damage target
          if (target.health) {
            withDamageSource(e, () => {
              target.health = Math.max(
                0,
                target.health! - e.attack!.damage * (target.progress ? 2 : 1),
              );
            });
          }
        }
        return;
      }

      if (distanceBetweenEntities(e, target) > e.attack.range) {
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

      // Face target
      if (e.turnSpeed) {
        const facing = e.facing ?? Math.PI * 3 / 2;
        const targetAngle = Math.atan2(
          target.position.y - e.position.y,
          target.position.x - e.position.x,
        );
        const diff = Math.abs(angleDifference(facing, targetAngle));
        if (diff > 1e-07) {
          const maxTurn = e.turnSpeed * delta;
          e.facing = diff < maxTurn
            ? targetAngle
            : tweenAbsAngles(facing, targetAngle, maxTurn);
        }
        // Must be facing ±60°
        if (diff > Math.PI / 3) {
          delta = Math.max(0, delta - (diff - Math.PI / 3) / e.turnSpeed);
        }
      }

      if (delta === 0) return;

      if ((e.lastAttack ?? 0) + e.attack.cooldown <= time) {
        e.swing = { time, source: e.position, target: target.position };
      }
    },
  });

  app.addSystem({
    props: ["position", "action", "isMoving", "attack"],
    onChange: (e) => {
      if (e.action.type !== "walk" || !e.queue?.length) return;
      const next = e.queue[0];
      if (next.type !== "attack") return;
      const target = lookup(next.target);
      if (target && distanceBetweenEntities(e, target) < e.attack.range) {
        delete (e as Entity).action;
      }
    },
  });
};
