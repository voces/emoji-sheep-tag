import { Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";

export const manaPotionOrder = {
  id: "manaPotion",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "manaPotion");
    if (!action || action.type !== "auto") return "failed";

    const order: Order = { type: "cast", orderId: "manaPotion", remaining: 0 };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "manaPotion");
    if (!action || action.type !== "auto" || !action.manaRestore) return false;

    if (unit.mana !== undefined && unit.maxMana !== undefined) {
      unit.mana = Math.min(unit.mana + action.manaRestore, unit.maxMana);
    }
  },
} satisfies OrderDefinition;
