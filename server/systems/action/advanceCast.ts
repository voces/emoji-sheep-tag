import { Entity } from "@/shared/types.ts";
import { getOrder } from "../../orders/index.ts";
import { findActionByOrder } from "../../util/actionLookup.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    const orderDef = getOrder(e.order.orderId);

    // Generic mana consumption for all orders
    const action = findActionByOrder(e, e.order.orderId);
    if (action && action.type === "auto" && action.manaCost) {
      const manaCost = action.manaCost;
      if (manaCost > 0 && e.mana) e.mana -= manaCost;
    }

    orderDef?.onCastStart?.(e);

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }

  if (delta < e.order.remaining) {
    console.log("not done", delta, e.order.remaining);
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  console.log("done!", e.order.orderId, getOrder(e.order.orderId));

  delta -= e.order.remaining;

  getOrder(e.order.orderId)?.onCastComplete?.(e);

  delete e.order;

  return delta;
};
