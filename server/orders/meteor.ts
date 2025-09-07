import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { damageEntity, newUnit } from "../api/unit.ts";
import { getEntitiesInRange } from "../systems/kd.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { testClassification } from "@/shared/api/unit.ts";

export const meteorOrder = {
  id: "meteor",

  canExecute: (unit) => {
    return !!(unit.owner && unit.position);
  },

  onIssue: (unit, target, queue) => {
    if (typeof target === "string") target = lookup(target)?.position;
    if (!target) return "failed";

    const order: Order = {
      type: "cast",
      orderId: "meteor",
      remaining: 0,
      target,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastComplete: (unit) => {
    // This is called when we reach the target location
    if (unit.order?.type !== "cast" || unit.order.orderId !== "meteor") return;

    const target = unit.order.target;
    if (!target || !unit.owner) {
      return console.warn("Either no target or owner");
    }

    const action = findActionByOrder(unit, "meteor");
    if (!action) return console.warn("No meteor action");

    const meteor = newUnit(unit.owner, "meteor", target.x, target.y + 0.75);
    meteor.isDoodad = true;

    const damageRadius = "aoe" in action ? action.aoe ?? 0 : 0;
    const damage = "damage" in action ? action.damage ?? 0 : 0;

    if (!damage || !damageRadius) return;

    const entities = getEntitiesInRange(target.x, target.y, damageRadius);

    for (const entity of entities) {
      if (
        "targeting" in action && action.targeting
          ? testClassification(unit, entity, action.targeting)
          : true
      ) damageEntity(unit, entity, damage);
    }
  },
} satisfies OrderDefinition;
