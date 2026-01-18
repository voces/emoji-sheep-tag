import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { lookup } from "../systems/lookup.ts";

export const crystalSpeedOrder = {
  id: "crystalSpeed",

  onIssue: (unit, target, queue) => {
    const action = findActionByOrder(unit, "crystalSpeed");
    if (!action || action.type !== "auto") return "failed";
    if (typeof target !== "string") return "failed";

    const castDuration = action.castDuration ?? 0.5;

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

    const action = findActionByOrder(unit, "crystalSpeed");
    const buffDuration =
      (action?.type === "auto" ? action.buffDuration : undefined) ?? 20;
    const movementSpeedMultiplier =
      (action?.type === "auto" ? action.movementSpeedMultiplier : undefined) ??
        1.25;
    const name = action && "buffName" in action ? action.buffName : "Gemstride";

    // Add speed buff to target
    target.buffs = [
      ...(target.buffs ?? []),
      {
        name,
        description: `+${
          Math.round((movementSpeedMultiplier - 1) * 100)
        }% movement speed`,
        remainingDuration: buffDuration,
        totalDuration: buffDuration,
        movementSpeedMultiplier,
        model: "sparkle2",
        modelOffset: { x: -0.23, y: 0.4 },
      },
    ];
  },
} satisfies OrderDefinition;
