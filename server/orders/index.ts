import { OrderDefinition } from "./types.ts";

import { mirrorImageOrder } from "./mirrorImage.ts";
import { foxOrder } from "./fox.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { speedPotOrder } from "./speedPot.ts";

const orderRegistry = new Map<string, OrderDefinition>();

export const getOrder = (orderId: string) => orderRegistry.get(orderId);

const registerOrder = (order: OrderDefinition) => {
  orderRegistry.set(order.id, order);
};
registerOrder(mirrorImageOrder);
registerOrder(foxOrder);
registerOrder(destroyLastFarmOrder);
registerOrder(speedPotOrder);
