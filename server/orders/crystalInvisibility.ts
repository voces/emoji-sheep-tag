import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { lookup } from "../systems/lookup.ts";

export const crystalInvisibilityOrder = {
  id: "crystalInvisibility",

  onIssue: (unit, target, queue) => {
    const action = findActionByOrder(unit, "crystalInvisibility");
    if (!action || action.type !== "auto") return "failed";
    if (typeof target !== "string") return "failed";

    const castDuration = action.castDuration ?? 0.5;

    const order: Order = {
      type: "cast",
      orderId: "crystalInvisibility",
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

    const action = findActionByOrder(unit, "crystalInvisibility");
    const buffDuration =
      (action?.type === "auto" ? action.buffDuration : undefined) ?? 60;
    const name = action && "buffName" in action
      ? action.buffName
      : "Invisiibiltiy";

    target.buffs = [
      ...(target.buffs ?? []),
      {
        name,
        description: "Invisible to enemies",
        remainingDuration: buffDuration,
        totalDuration: buffDuration,
        invisible: true,
        icon: "eye",
      },
    ];
  },
} satisfies OrderDefinition;
