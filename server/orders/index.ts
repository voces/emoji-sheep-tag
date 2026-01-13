import { OrderDefinition } from "./types.ts";

import { mirrorImageOrder } from "./mirrorImage.ts";
import { foxOrder } from "./fox.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { speedPotOrder } from "./speedPot.ts";
import { strengthPotionOrder } from "./strengthPotion.ts";
import { meteorOrder } from "./meteor.ts";
import { biteOrder } from "./bite.ts";
import { manaPotionOrder } from "./manaPotion.ts";
import { sentryOrder } from "./sentry.ts";
import { locateSheepOrder } from "./locateSheep.ts";
import { cancelUpgradeOrder } from "./cancelUpgrade.ts";
import { selfDestructOrder } from "./selfDestruct.ts";
import { swapOrder } from "./swap.ts";
import { dodgeOrder } from "./dodge.ts";
import { giveToEnemyOrder } from "./giveToEnemy.ts";
import { reclaimFromEnemyOrder } from "./reclaimFromEnemy.ts";
import { crystalSpeedOrder } from "./crystalSpeed.ts";
import { crystalInvisibilityOrder } from "./crystalInvisibility.ts";
import { hayTrapOrder } from "./hayTrap.ts";
import { beamOrder } from "./beam.ts";
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
registerOrder(biteOrder);
registerOrder(manaPotionOrder);
registerOrder(sentryOrder);
registerOrder(locateSheepOrder);
registerOrder(cancelUpgradeOrder);
registerOrder(selfDestructOrder);
registerOrder(swapOrder);
registerOrder(dodgeOrder);
registerOrder(giveToEnemyOrder);
registerOrder(reclaimFromEnemyOrder);
registerOrder(crystalSpeedOrder);
registerOrder(crystalInvisibilityOrder);
registerOrder(hayTrapOrder);
registerOrder(beamOrder);
registerOrder(editorRemoveEntity);
registerOrder(editorMoveEntityDown);
registerOrder(editorMoveEntityLeft);
registerOrder(editorMoveEntityRight);
registerOrder(editorMoveEntityUp);
