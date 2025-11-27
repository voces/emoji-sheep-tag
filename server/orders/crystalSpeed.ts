import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { lookup } from "../systems/lookup.ts";

export const crystalSpeedOrder = {
  id: "crystalSpeed",

  onIssue: (unit, target, queue) => {
    if (typeof target !== "string") return "failed";

    const action = findActionByOrder(unit, "crystalSpeed");
    const castDuration =
      (action?.type === "target" ? action.castDuration : undefined) ?? 0.5;

    const order: Order = {
      type: "cast",
      orderId: "crystalSpeed",
      remaining: castDuration,
      targetId: target,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastComplete: (unit) => {
    if (unit.order?.type !== "cast" || !unit.order.targetId) return;

    const target = lookup(unit.order.targetId);
    if (!target) return;

    const buffDuration = 20;

    // Add speed buff to target
    target.buffs = [
      ...(target.buffs ?? []),
      {
        name: "Crystal Speed",
        description: "+25% movement speed",
        remainingDuration: buffDuration,
        totalDuration: buffDuration,
        movementSpeedMultiplier: 1.25,
        model: "sparkle2",
        modelOffset: { x: -0.23, y: 0.4 },
      },
    ];
  },
} satisfies OrderDefinition;
