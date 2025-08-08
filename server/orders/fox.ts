import { DEFAULT_FACING } from "@/shared/constants.ts";
import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";

export const foxOrder = {
  id: "fox",

  // The action data that goes on prefabs
  action: {
    type: "auto" as const,
    order: "fox" as const,
    name: "Summon Fox",
    binding: ["KeyF"],
    castDuration: 0.3,
    manaCost: 10,
  },

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    // Must have owner and position
    return !!(unit.owner && unit.position);
  },

  // Called when the order is initiated (sets up the order on the unit)
  initiate: (unit: Entity) => {
    unit.order = {
      type: "cast",
      orderId: "fox",
      remaining: foxOrder.action.castDuration ?? 0,
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
