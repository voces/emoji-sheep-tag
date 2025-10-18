import { Entity, Item, UnitDataAction } from "@/shared/types.ts";
import { consumeItem } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { deductPlayerGold } from "../api/player.ts";

export const postCast = (
  entity: Entity,
  item?: Item,
  action?: UnitDataAction,
): boolean => {
  if (item) consumeItem(entity, item);

  if (entity.owner) {
    const a = action ??
      findActionByOrder(
        entity,
        entity.order?.type === "cast" ? entity.order.orderId : "",
      );
    if (a?.goldCost) deductPlayerGold(entity.owner, a.goldCost);
  }

  return true;
};
