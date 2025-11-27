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
        name: "Potion of Speed",
        description: `+${
          Math.round((action.movementSpeedMultiplier - 1) * 100)
        }% movement speed`,
        remainingDuration: action.buffDuration,
        totalDuration: action.buffDuration,
        movementSpeedMultiplier: action.movementSpeedMultiplier,
        model: "rune2",
        modelOffset: { x: -0.2, y: 0.4 },
      });
    }

    if (action.attackSpeedMultiplier) {
      buffs.push({
        name: "Potion of Speed",
        description: `+${
          Math.round((action.attackSpeedMultiplier - 1) * 100)
        }% attack speed`,
        remainingDuration: action.buffDuration,
        totalDuration: action.buffDuration,
        attackSpeedMultiplier: action.attackSpeedMultiplier,
      });
    }

    // Add buffs to entity
    if (buffs.length > 0) unit.buffs = [...(unit.buffs || []), ...buffs];

    return true;
  },
} satisfies OrderDefinition;
