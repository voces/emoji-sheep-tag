import { Entity } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { playSoundAt } from "../api/sound.ts";

export const precast = (entity: Entity, ordered = true): boolean => {
  // console.log("precast1");
  if (entity.order?.type !== "cast") return !ordered;
  // console.log("precast2");
  // Generic mana consumption for all orders
  const action = findActionByOrder(entity, entity.order.orderId);
  if (!action) return false;
  // console.log("precast3");
  if ("manaCost" in action && action.manaCost) {
    // console.log("precast4");
    if ((entity.mana ?? 0) < action.manaCost) return false;
    // console.log("precast5");

    const manaCost = action.manaCost;
    if (manaCost > 0 && entity.mana) entity.mana -= manaCost;
  }

  if (
    "soundOnCastStart" in action && action.soundOnCastStart &&
    entity.position
  ) playSoundAt(entity.position, action.soundOnCastStart);

  // console.log("precast6");
  return true;
};
