import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { computeUnitAttackSpeed, damageEntity } from "../../api/unit.ts";

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
    const attackSpeedMultiplier = computeUnitAttackSpeed(e);
    e.attackCooldownRemaining = e.attack.cooldown / attackSpeedMultiplier;
    const swingTarget = e.swing.target;
    delete e.swing;

    // Miss if target too far
    if (
      distanceBetweenPoints(target.position, swingTarget) >
        e.attack.rangeMotionBuffer
    ) return delta;

    // Otherwise damage target
    if (target.health) damageEntity(e, target);

    // Consume buffs that are marked as consumeOnAttack
    if (e.buffs) {
      const updatedBuffs = e.buffs.filter((buff) => !buff.consumeOnAttack);
      e.buffs = updatedBuffs.length ? null : updatedBuffs;
    }
  }

  return delta;
};
