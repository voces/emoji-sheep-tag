import { DEFAULT_FACING } from "@/shared/constants.ts";
import { Entity, Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const foxOrder = {
  id: "fox",

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    // Must have owner and position
    return !!(unit.owner && unit.position);
  },

  // Called when the order is initiated (sets up the order on the unit)
  onIssue: (unit: Entity, _, queue) => {
    const action = findActionByOrder(unit, "fox");
    const castDuration =
      (action?.type === "auto" ? action.castDuration : undefined) ?? 0.3;
    const order: Order = {
      type: "cast",
      orderId: "fox",
      remaining: castDuration,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "incomplete";
  },

  // Called when the cast completes (spawn fox)
  onCastComplete: (unit: Entity) => {
    if (!unit.owner || !unit.position) return false;

    const action = findActionByOrder(unit, "fox");
    if (!action) return false;

    const angle = unit.facing ?? DEFAULT_FACING;
    const x = unit.position.x + Math.cos(angle);
    const y = unit.position.y + Math.sin(angle);
    const fox = newUnit(unit.owner, "fox", x, y);

    // Get lifetime duration from the action definition
    const lifetime = action.type === "auto" ? action.buffDuration : undefined;
    if (lifetime) {
      fox.buffs = [{ remainingDuration: lifetime, expiration: "Fox" }];
    }
  },
} satisfies OrderDefinition;
