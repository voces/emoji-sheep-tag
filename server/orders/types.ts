import { Entity } from "@/shared/types.ts";

export interface OrderDefinition {
  // The order ID that identifies this order
  id: string;

  // Check if the unit can execute this order (mana, conditions, etc)
  canExecute?: (unit: Entity) => boolean;

  // Called when the order is initiated (sets up the order on the unit)
  initiate: (unit: Entity) => void;

  // Called when the cast starts (side effects like mana consumption, clearing old state)
  onCastStart?: (unit: Entity) => void;

  // Called when the cast completes (spawn units, create effects, etc)
  onCastComplete?: (unit: Entity) => void;
}

// Registry to hold all order definitions
export const orderRegistry = new Map<string, OrderDefinition>();

export const registerOrder = (order: OrderDefinition) => {
  orderRegistry.set(order.id, order);
};

export const getOrder = (orderId: string) => {
  return orderRegistry.get(orderId);
};
