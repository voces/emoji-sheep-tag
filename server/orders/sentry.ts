import { Entity, Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { Point } from "@/shared/pathing/math.ts";

export const sentryOrder: OrderDefinition = {
  id: "sentry",

  onIssue: (unit, target, queue) => {
    if (typeof target === "string") return "failed";

    const action = findActionByOrder(unit, "sentry");
    if (!action) return "failed";

    const order: Order = {
      type: "cast",
      orderId: "sentry",
      remaining: "castDuration" in action ? action.castDuration ?? 0 : 0,
      target: target as Point,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastComplete: (unit: Entity) => {
    if (unit.order?.type !== "cast" || !unit.order.target) return;

    if (!unit.owner) return;

    const { x, y } = unit.order.target;
    newUnit(unit.owner, "sentry", x, y);
  },
};
