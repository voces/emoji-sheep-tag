import { Buff, Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";

export const strengthPotionOrder = {
  id: "strengthPotion",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "strengthPotion");
    if (!action || action.type !== "auto" || !action.buffDuration) {
      return "failed";
    }

    const order: Order = {
      type: "cast",
      orderId: "strengthPotion",
      remaining: 0,
    };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "strengthPotion");
    if (
      !action || action.type !== "auto" || !action.buffDuration ||
      !action.damageMultiplier
    ) {
      return false;
    }

    // Add strength buff using damage multiplier from action definition
    const strengthBuff: Buff = {
      remainingDuration: action.buffDuration,
      damageMultiplier: action.damageMultiplier,
      consumeOnAttack: true,
      model: "rune",
      modelOffset: { x: 0.2, y: 0.4 },
    };

    // Add buff to entity
    unit.buffs = [...(unit.buffs || []), strengthBuff];
  },
} satisfies OrderDefinition;
