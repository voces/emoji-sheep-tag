import { DEFAULT_FACING } from "@/shared/constants.ts";
import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const foxOrder = {
  id: "fox",

  onIssue: (unit, _, queue) => {
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

    return "ordered";
  },

  onCastComplete: (unit) => {
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
      fox.buffs = [{
        remainingDuration: lifetime,
        totalDuration: lifetime,
        expiration: "Fox",
      }];
    }
  },
} satisfies OrderDefinition;
