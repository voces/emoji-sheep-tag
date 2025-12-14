import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { applyAndConsumeBuffs, damageEntity } from "../../api/unit.ts";
import { newFloatingText } from "../../api/floatingText.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { computeUnitAttackSpeed } from "@/shared/api/unit.ts";

export const tweenSwing = (e: Entity, delta: number): number => {
  if (!e.swing || !e.attack) return delta;

  // Determine if this is ground attack or entity attack
  let target: Entity | undefined;
  let targetPosition: { x: number; y: number } | undefined;

  if (e.order && (e.order.type === "attack" || e.order.type === "attackMove")) {
    if ("targetId" in e.order) {
      target = lookup(e.order.targetId);
      targetPosition = target?.position;
    } else if ("target" in e.order) {
      targetPosition = e.order.target;
    }
  }

  if (!targetPosition) return delta;

  // For ranged attacks (with projectileSpeed), don't abort during backswing
  const isRangedAttack = !!e.attack.projectileSpeed;

  // Abort swing if cannot reach target anymore (but only during backswing for melee, and only for entity attacks)
  if (
    !isRangedAttack &&
    target &&
    e.swing.remaining > e.attack.backswing &&
    distanceBetweenPoints(targetPosition, e.swing.target) >
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

    // For ranged attacks, spawn a projectile
    if (isRangedAttack && e.position && e.attack.projectileSpeed) {
      addEntity({
        position: { x: e.position.x, y: e.position.y },
        isDoodad: true,
        model: e.attack.model,
        buffs: e.buffs, // TODO: No? Apply buffs from attackerId, though
        sounds: e.sounds?.projectileHit
          ? { death: e.sounds.projectileHit }
          : undefined,
        projectile: {
          attackerId: e.id,
          target: { x: targetPosition.x, y: targetPosition.y },
          speed: e.attack.projectileSpeed,
          splashRadius: e.attack.rangeMotionBuffer,
        },
      });

      return delta;
    }

    // For melee attacks, check for miss (only for entity attacks)
    if (
      target &&
      distanceBetweenPoints(targetPosition, swingTarget) >
        e.attack.rangeMotionBuffer
    ) {
      if (e.position) {
        newFloatingText({ x: e.position.x, y: e.position.y + 0.5 }, "miss", {
          color: 0xff0303,
          speed: 1.5,
        });
      }
      return delta;
    }

    if (target) {
      // Otherwise damage target (melee, entity attacks only)
      if (target.health) damageEntity(e, target);

      applyAndConsumeBuffs(e, target);
    }
  }

  return delta;
};
