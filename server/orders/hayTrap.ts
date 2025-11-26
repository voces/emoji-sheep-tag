import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { addSystem } from "@/shared/context.ts";
import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { removeEntity } from "@/shared/api/entity.ts";

import type { Entity } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

const hayTrapProjectiles = new Map<
  Entity,
  { hay: Entity; target: { x: number; y: number } }
>();

const hayTrapData = new WeakMap<Entity, NonNullable<Entity["projectile"]>>();

export const hayTrapOrder = {
  id: "hayTrap",

  onIssue: (unit, target, queue) => {
    if (typeof target === "string") target = lookup(target)?.position;
    if (!target) return "failed";

    const action = findActionByOrder(unit, "hayTrap");
    if (!action) return "failed";

    const order: Order = {
      type: "cast",
      orderId: "hayTrap",
      remaining: "castDuration" in action ? action.castDuration ?? 0 : 0,
      target,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastStart: (unit) => {
    if (unit.order?.type !== "cast" || unit.order.orderId !== "hayTrap") return;

    const target = unit.order.target;
    if (!target || !unit.owner || !unit.position) {
      return console.warn("Missing target, owner, or position");
    }

    const hay = newUnit(
      unit.owner,
      "hayCube",
      unit.position.x,
      unit.position.y,
    );

    hayTrapProjectiles.set(unit, { hay, target });
  },

  onCastComplete: (unit) => {
    const data = hayTrapProjectiles.get(unit);
    if (data) {
      data.hay.projectile = {
        attackerId: unit.id,
        target: data.target,
        speed: data.hay.movementSpeed ?? 10,
        splashRadius: 0,
      };
      hayTrapProjectiles.delete(unit);
    }
  },
} satisfies OrderDefinition;

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
