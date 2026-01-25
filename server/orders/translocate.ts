import { Order, SystemEntity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { lookup } from "../systems/lookup.ts";
import { translocateUnit } from "../api/unit.ts";

export const translocateOrder = {
  id: "translocate",

  onIssue: (unit, target, queue) => {
    const action = findActionByOrder(unit, "translocate");
    if (!action || action.type !== "auto") return "failed";
    if (typeof target !== "string") return "failed";

    const order: Order = {
      type: "cast",
      orderId: "translocate",
      remaining: action.castDuration ?? 0,
      targetId: target,
    };

    if (queue) unit.queue = [...(unit.queue ?? []), order];
    else {
      delete unit.queue;
      unit.order = order;
    }
    return "ordered";
  },

  onCastComplete: (unit) => {
    if (unit.order?.type !== "cast" || !unit.order.targetId) return;
    if (!unit.position) return;

    const target = lookup(unit.order.targetId);
    if (!target?.position || typeof target.radius !== "number") return;

    translocateUnit(
      target as SystemEntity<"position" | "radius">,
      unit.position,
      unit.id,
    );
  },
} satisfies OrderDefinition;
