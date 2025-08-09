import { Entity } from "@/shared/types.ts";

export type OrderDefinition = {
  // The order ID that identifies this order
  id: string;

  // Check if the unit can execute this order (mana, conditions, etc)
  canExecute?: (unit: Entity) => boolean;

  // Called when the order is issued (sets up the order on the unit)
  onIssue: (unit: Entity) => "immediate" | "ordered" | "failed";

  // Called when the cast starts (side effects like mana consumption, clearing old state)
  onCastStart?: (unit: Entity) => void;

  // Called when the cast completes (spawn units, create effects, etc)
  onCastComplete?: (unit: Entity) => void;
};
