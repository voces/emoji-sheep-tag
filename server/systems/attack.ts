import { distanceBetweenPoints } from "../../shared/pathing/math.ts";
import { distanceBetweenEntities } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { UnitDeathEvent } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { calcPath } from "./pathing.ts";

export const advanceAttack = (e: Entity, delta: number): number => {
  const app = currentApp();

  if (e.action?.type !== "attack" || !e.position) {
    if (e.swing) delete e.swing;
    return delta;
  }

  if (!e.attack) {
    if (e.swing) delete e.swing;
    delete e.action;
    return delta;
  }

  const target = lookup(e.action.target);

  if (!target || !target.position || target.health === 0) {
    if (e.swing) delete e.swing;
    delete e.action;
    return delta;
  }

  if (e.swing) {
    // Abort swing if cannot reach target anymore (but only during backswing)
    if (
      e.swing.remaining > e.attack.backswing &&
      distanceBetweenPoints(target.position, e.swing.target) >
        e.attack.rangeMotionBuffer
    ) {
      delete e.swing;
      return delta;
    }

    // Consume timing to carry out swing
    const swingAmount = Math.min(e.swing.remaining, delta);
    delta -= swingAmount;
    e.swing = { ...e.swing, remaining: e.swing.remaining - swingAmount };

    // Complete swing if damage point reached
    if (!e.swing.remaining) {
      // House keeping for attacks
      e.attackCooldownRemaining = e.attack.cooldown;
      const swingTarget = e.swing.target;
      delete e.swing;

      // Miss if target too far
      if (
        distanceBetweenPoints(target.position, swingTarget) >
          e.attack.rangeMotionBuffer
      ) return delta;

      // Otherwise damage target
      if (target.health) {
        target.health = Math.max(
          0,
          target.health! -
            e.attack!.damage * (target.progress ? 2 : 1) *
              // Do extremely minor damage to units to trigger sound
              (e.isMirror ? target.tilemap ? 0.25 : 0.001 : 1),
        );
        if (target.health === 0) {
          app.dispatchTypedEvent("unitDeath", new UnitDeathEvent(target, e));
        }
      }
    }
    return delta;
  }

  // Target too far, cancel attack and start walking
  if (distanceBetweenEntities(e, target) > e.attack.range) {
    const path = calcPath(e, e.action.target, { mode: "attack" }).slice(1);

    // If no longer pathable, give up
    if (
      !path.length ||
      (path[path.length - 1].x === e.position.x &&
        path[path.length - 1].y === e.position.y)
    ) {
      delete e.action;
      return delta;
    }

    // Otherwise start walking!
    e.queue = [e.action, ...(e.queue ?? [])];
    e.action = {
      type: "walk",
      target: e.action.target,
      distanceFromTarget: e.attack.range,
      path,
      attacking: true,
    };
    return delta;
  }

  if (!e.attackCooldownRemaining) {
    e.swing = {
      remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
      source: e.position,
      target: target.position,
    };
    return delta;
  }

  return 0;
};
