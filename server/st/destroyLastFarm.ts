import { Entity } from "../../shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const handleDestroyLastFarm = (unit: Entity) => {
  if (!unit.owner) return;

  // Find the destroy last farm action to get its cast duration
  const destroyLastFarmAction = findActionByOrder(unit, "destroyLastFarm");
  if (!destroyLastFarmAction) return;

  // Get cast duration from action, default to 0 if not specified
  const castDuration =
    ("castDuration" in destroyLastFarmAction
      ? destroyLastFarmAction.castDuration
      : undefined) ?? 0;

  // Set cast order and clear queue
  unit.order = {
    type: "cast",
    orderId: "destroyLastFarm",
    remaining: castDuration,
  };
  delete unit.queue;
};
