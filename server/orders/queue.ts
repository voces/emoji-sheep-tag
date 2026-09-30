import { Entity, Order } from "@/shared/types.ts";

/** Appends the order to the unit's queue, or replaces its current order and queue. */
export const queueOrReplaceOrder = (
  unit: Entity,
  order: Order,
  queue: boolean,
) => {
  if (queue) unit.queue = [...unit.queue ?? [], order];
  else {
    delete unit.queue;
    unit.order = order;
  }
};
