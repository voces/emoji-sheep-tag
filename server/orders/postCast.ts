import { Entity, Item, UnitDataAction } from "@/shared/types.ts";
import { consumeItem } from "../api/unit.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { deductPlayerGold, grantPlayerGold } from "../api/player.ts";

export const postCast = (
  entity: Entity,
  item?: Item,
  action?: UnitDataAction,
): boolean => {
  if (item) consumeItem(entity, item);

  const a = action ??
    findActionByOrder(
      entity,
      entity.order?.type === "cast" ? entity.order.orderId : "",
    );

  if (entity.owner && a?.goldCost) {
    if (a.goldCost > 0) deductPlayerGold(entity.owner, a.goldCost);
    else grantPlayerGold(entity.owner, -a.goldCost);
  }

  // Set action cooldown
  if (a && "cooldown" in a && a.cooldown && "order" in a) {
    entity.actionCooldowns = {
      ...entity.actionCooldowns,
      [a.order]: a.cooldown,
    };
  }

  return true;
};
