// Import all order definitions
import { mirrorImageOrder } from "./mirrorImage.ts";
import { foxOrder } from "./fox.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { speedPotOrder } from "./speedPot.ts";
import { registerOrder } from "./types.ts";

// Register all orders
registerOrder(mirrorImageOrder);
registerOrder(foxOrder);
registerOrder(destroyLastFarmOrder);
registerOrder(speedPotOrder);

// Export all orders for convenience
export { mirrorImageOrder } from "./mirrorImage.ts";
export { foxOrder } from "./fox.ts";
export { destroyLastFarmOrder } from "./destroyLastFarm.ts";
export { speedPotOrder } from "./speedPot.ts";
export * from "./types.ts";
