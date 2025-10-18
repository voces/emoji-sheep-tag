import { OrderDefinition } from "./types.ts";

import { mirrorImageOrder } from "./mirrorImage.ts";
import { foxOrder } from "./fox.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { speedPotOrder } from "./speedPot.ts";
import { strengthPotionOrder } from "./strengthPotion.ts";
import { meteorOrder } from "./meteor.ts";
import { saveOrder } from "./save.ts";
import { manaPotionOrder } from "./manaPotion.ts";
import { sentryOrder } from "./sentry.ts";
import { illusifyOrder } from "./illusify.ts";
import { locateSheepOrder } from "./locateSheep.ts";
import { cancelUpgradeOrder } from "./cancelUpgrade.ts";
import { editorRemoveEntity } from "./editorRemoveEntity.ts";
import {
  editorMoveEntityDown,
  editorMoveEntityLeft,
  editorMoveEntityRight,
  editorMoveEntityUp,
} from "./editorMoveEntity.ts";

const orderRegistry = new Map<string, OrderDefinition>();

export const getOrder = (orderId: string) => orderRegistry.get(orderId);

const registerOrder = (order: OrderDefinition) => {
  orderRegistry.set(order.id, order);
};
registerOrder(mirrorImageOrder);
registerOrder(foxOrder);
registerOrder(destroyLastFarmOrder);
registerOrder(speedPotOrder);
registerOrder(strengthPotionOrder);
registerOrder(meteorOrder);
registerOrder(saveOrder);
registerOrder(manaPotionOrder);
registerOrder(sentryOrder);
registerOrder(illusifyOrder);
registerOrder(locateSheepOrder);
registerOrder(cancelUpgradeOrder);
registerOrder(editorRemoveEntity);
registerOrder(editorMoveEntityDown);
registerOrder(editorMoveEntityLeft);
registerOrder(editorMoveEntityRight);
registerOrder(editorMoveEntityUp);
