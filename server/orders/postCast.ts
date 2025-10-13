import { Entity, Item } from "@/shared/types.ts";
import { consumeItem } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { deductPlayerGold } from "../api/player.ts";

export const postCast = (
  entity: Entity,
  item?: Item,
  orderId?: string,
): boolean => {
  orderId ??= entity.order?.type === "cast" ? entity.order.orderId : undefined;

  if (item) consumeItem(entity, item);

  if (orderId && entity.owner) {
    const action = findActionByOrder(entity, orderId);
    if (action && "goldCost" in action && action.goldCost) {
      deductPlayerGold(entity.owner, action.goldCost);
    }
  }

  return true;
};
