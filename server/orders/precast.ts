import { Entity, UnitDataAction } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { playSoundAt } from "../api/sound.ts";
import { getPlayerGold } from "../api/player.ts";

export const precast = (
  entity: Entity,
  action?: UnitDataAction,
): boolean => {
  // Generic validation and mana consumption for all orders
  const a = action ??
    findActionByOrder(
      entity,
      entity.order?.type === "cast" ? entity.order.orderId : "",
    );
  if (!a) return false;

  // Check gold cost (validation only, actual consumption happens in postCast)
  if (a.goldCost && entity.owner) {
    if (getPlayerGold(entity.owner) < a.goldCost) return false;
  }

  // Check and consume mana
  if ("manaCost" in a && a.manaCost) {
    if ((entity.mana ?? 0) < a.manaCost) return false;

    const manaCost = a.manaCost;
    if (manaCost > 0 && entity.mana) entity.mana -= manaCost;
  }

  if (
    "soundOnCastStart" in a && a.soundOnCastStart &&
    entity.position
  ) playSoundAt(entity.position, a.soundOnCastStart);

  return true;
};
