import { Entity } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { playSoundAt } from "../api/sound.ts";
import { getPlayerGold } from "../api/player.ts";

export const precast = (
  entity: Entity,
  ordered = true,
  orderId?: string,
): boolean => {
  orderId ??= entity.order?.type === "cast" ? entity.order.orderId : undefined;

  if (!orderId) return !ordered;

  // Generic validation and mana consumption for all orders
  const action = findActionByOrder(entity, orderId);
  if (!action) return false;

  // Check gold cost (validation only, actual consumption happens in postCast)
  if ("goldCost" in action && action.goldCost && entity.owner) {
    if (getPlayerGold(entity.owner) < action.goldCost) return false;
  }

  // Check and consume mana
  if ("manaCost" in action && action.manaCost) {
    if ((entity.mana ?? 0) < action.manaCost) return false;

    const manaCost = action.manaCost;
    if (manaCost > 0 && entity.mana) entity.mana -= manaCost;
  }

  if (
    "soundOnCastStart" in action && action.soundOnCastStart &&
    entity.position
  ) playSoundAt(entity.position, action.soundOnCastStart);

  return true;
};
