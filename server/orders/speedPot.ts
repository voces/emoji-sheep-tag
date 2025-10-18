import { Buff, Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";

export const speedPotOrder = {
  id: "speedPot",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "speedPot");
    if (!action || action.type !== "auto" || !action.buffDuration) {
      return "failed";
    }

    const order: Order = { type: "cast", orderId: "speedPot", remaining: 0 };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "speedPot");
    if (!action || action.type !== "auto" || !action.buffDuration) {
      return false;
    }

    const buffs: Buff[] = [];

    if (action.movementSpeedMultiplier) {
      buffs.push({
        remainingDuration: action.buffDuration,
        movementSpeedMultiplier: action.movementSpeedMultiplier,
      });
    }

    if (action.attackSpeedMultiplier) {
      buffs.push({
        remainingDuration: action.buffDuration,
        attackSpeedMultiplier: action.attackSpeedMultiplier,
      });
    }

    if (action.movementSpeedBonus) {
      buffs.push({
        remainingDuration: action.buffDuration,
        movementSpeedBonus: action.movementSpeedBonus,
      });
    }

    // Add buffs to entity
    if (buffs.length > 0) unit.buffs = [...(unit.buffs || []), ...buffs];
  },
} satisfies OrderDefinition;
