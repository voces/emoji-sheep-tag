import { OrderOverride } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { addSystem } from "@/shared/context.ts";
import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { removeEntity } from "@/shared/api/entity.ts";

import type { Entity } from "@/shared/types.ts";

const hayTrapProjectiles = new Map<
  Entity,
  { hay: Entity; target: { x: number; y: number } }
>();

const hayTrapData = new WeakMap<Entity, NonNullable<Entity["projectile"]>>();

export const hayTrapOrder = {
  onCastStart: (unit) => {
    if (unit.order?.type !== "cast" || unit.order.orderId !== "hayTrap") return;

    const target = unit.order.target ??
      (unit.order.targetId ? lookup(unit.order.targetId)?.position : undefined);
    if (!target || !unit.owner || !unit.position) {
      return console.warn("Missing target, owner, or position");
    }

    const hay = newUnit(
      unit.owner,
      "hayCube",
      unit.position.x,
      unit.position.y,
      { isEffect: true },
    );

    hayTrapProjectiles.set(unit, { hay, target });
  },

  onCastComplete: (unit) => {
    const data = hayTrapProjectiles.get(unit);
    if (data && data.hay.position) {
      const speed = data.hay.movementSpeed ?? 10;
      const distance = distanceBetweenPoints(data.hay.position, data.target);
      const flightTime = distance / speed;
      // Calculate tumble speed for ~2 rotations, rounded to land at default facing
      const rotations = Math.max(1, Math.round(flightTime * 2));
      // Tumble direction: negative when thrown right (clockwise), positive when thrown left
      const direction = data.target.x > data.hay.position.x ? -1 : 1;
      const tumble = direction * (rotations * Math.PI * 2) / flightTime;

      data.hay.projectile = {
        attackerId: unit.id,
        target: data.target,
        speed,
        splashRadius: 0,
        tumble,
      };
      hayTrapProjectiles.delete(unit);
    }
  },
} satisfies OrderOverride;

const handlePotentialInterrupt = (e: Entity) => {
  if (e.order?.type === "cast" && e.order.orderId === "hayTrap") return;
  const data = hayTrapProjectiles.get(e);
  if (data) {
    removeEntity(data.hay);
    hayTrapProjectiles.delete(e);
  }
};
addSystem({
  props: ["order"],
  onChange: handlePotentialInterrupt,
  onRemove: handlePotentialInterrupt,
});

addSystem({
  props: ["projectile"],
  onAdd: (e) => e.prefab === "hayCube" && hayTrapData.set(e, e.projectile),
  onChange: (e) => e.prefab === "hayCube" && hayTrapData.set(e, e.projectile),
  onRemove: (e) => {
    if (!e.position) return;

    const projectileData = hayTrapData.get(e);
    if (!projectileData) return;

    const distance = distanceBetweenPoints(e.position, projectileData.target);

    // If within range of target, spawn broken hay cube
    if (distance <= 0.125) {
      const owner = e.owner ?? lookup(projectileData.attackerId)?.owner;
      if (owner) {
        newUnit(
          owner,
          "brokenHayCube",
          projectileData.target.x,
          projectileData.target.y,
        );
      }
    }
  },
});
