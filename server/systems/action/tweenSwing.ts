import { distanceBetweenPoints } from "../../../shared/pathing/math.ts";
import { Entity } from "../../../shared/types.ts";
import { currentApp } from "../../contexts.ts";
import { UnitDeathEvent } from "../../ecs.ts";
import { lookup } from "../lookup.ts";

export const tweenSwing = (e: Entity, delta: number): number => {
  if (!e.swing || !e.attack) return delta;

  const targetId = e.order && "targetId" in e.order
    ? e.order.targetId
    : undefined;
  if (!targetId) return delta;

  const target = lookup(targetId);
  if (!target?.position) return delta;

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
        currentApp().dispatchTypedEvent(
          "unitDeath",
          new UnitDeathEvent(target, e),
        );
      }
    }
  }

  return delta;
};
