// Import all order definitions
import { mirrorImageOrder } from "./mirrorImage.ts";
import { foxOrder } from "./fox.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { registerOrder } from "./types.ts";

// Register all orders
registerOrder(mirrorImageOrder);
registerOrder(foxOrder);
registerOrder(destroyLastFarmOrder);

// Export all orders for convenience
export { mirrorImageOrder } from "./mirrorImage.ts";
export { foxOrder } from "./fox.ts";
export { destroyLastFarmOrder } from "./destroyLastFarm.ts";
export * from "./types.ts";
