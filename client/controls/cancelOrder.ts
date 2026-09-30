import {
  cancelOrder as cancelOrderHandler,
  getActiveOrder,
} from "./orderHandlers.ts";
import { cancelBlueprint, getBlueprintPrefab } from "./blueprintHandlers.ts";

export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  if (check && !check(getActiveOrder()?.order, getBlueprintPrefab())) return;
  cancelOrderHandler(check);
  cancelBlueprint();
};
