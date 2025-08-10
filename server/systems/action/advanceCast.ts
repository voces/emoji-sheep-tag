import { Entity } from "@/shared/types.ts";
import { getOrder } from "../../orders/index.ts";
import { findActionByOrder } from "../../util/actionLookup.ts";
import { currentApp } from "../../contexts.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    const orderDef = getOrder(e.order.orderId);

    // Generic mana consumption for all orders
    const action = findActionByOrder(e, e.order.orderId);
    if (action && "manaCost" in action && action.manaCost) {
      const manaCost = action.manaCost;
      if (manaCost > 0 && e.mana) e.mana -= manaCost;
    }

    if (
      action && "soundOnCastStart" in action && action.soundOnCastStart &&
      e.position && e.owner
    ) {
      const app = currentApp();
      app.addEntity({
        id: `sound-${Date.now()}-${Math.random()}`,
        owner: e.owner,
        position: { x: e.position.x, y: e.position.y },
        sounds: { birth: [action.soundOnCastStart] },
        buffs: [{ remainingDuration: 0.1, expiration: "Sound" }],
      });
    }

    orderDef?.onCastStart?.(e);

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }

  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  getOrder(e.order.orderId)?.onCastComplete?.(e);

  delete e.order;

  return delta;
};
