import { Entity } from "../../../shared/types.ts";
import { getOrder } from "../../orders/index.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    const orderDef = getOrder(e.order.orderId);

    // Generic mana consumption for all orders
    if (orderDef?.action && "manaCost" in orderDef.action) {
      const manaCost = orderDef.action.manaCost ?? 0;
      if (manaCost > 0 && e.mana) {
        e.mana -= manaCost;
      }
    }

    // Order-specific cast start logic
    if (orderDef?.onCastStart) {
      orderDef.onCastStart(e);
    }

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }

  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  // Handle cast completion
  const orderDef = getOrder(e.order.orderId);
  if (orderDef?.onCastComplete) {
    orderDef.onCastComplete(e);
  } else {
    console.warn(`Unhandled cast order ${e.order.orderId}`);
  }

  delete e.order;

  return delta;
};
