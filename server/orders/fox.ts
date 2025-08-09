import { DEFAULT_FACING } from "@/shared/constants.ts";
import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const foxOrder = {
  id: "fox",

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    // Must have owner and position
    return !!(unit.owner && unit.position);
  },

  // Called when the order is initiated (sets up the order on the unit)
  initiate: (unit: Entity) => {
    const action = findActionByOrder(unit, "fox");
    const castDuration =
      (action?.type === "auto" ? action.castDuration : undefined) ?? 0.3;
    unit.order = {
      type: "cast",
      orderId: "fox",
      remaining: castDuration,
    };
    delete unit.queue;
  },

  // Called when the cast completes (spawn fox)
  onCastComplete: (unit: Entity) => {
    if (unit.owner && unit.position) {
      const angle = unit.facing ?? DEFAULT_FACING;
      const x = unit.position.x + Math.cos(angle);
      const y = unit.position.y + Math.sin(angle);
      newUnit(unit.owner, "fox", x, y);
    }
  },
} satisfies OrderDefinition;
