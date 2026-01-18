import { Entity, UnitDataAction } from "@/shared/types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { playSoundAt } from "../api/sound.ts";
import { getPlayerGold } from "../api/player.ts";

/** Check if an action can be executed (constructing, mana, gold, cooldown) without consuming resources */
export const canExecuteAction = (
  entity: Entity,
  action: UnitDataAction,
): boolean => {
  // Check if action can execute during construction
  const isConstructing = typeof entity.progress === "number";
  const canExecuteWhileConstructing = "canExecuteWhileConstructing" in action &&
    action.canExecuteWhileConstructing === true;
  if (isConstructing && !canExecuteWhileConstructing) return false;

  // Check gold cost
  if (action.goldCost && entity.owner) {
    if (getPlayerGold(entity.owner) < action.goldCost) return false;
  }

  // Check cooldown
  if ("cooldown" in action && action.cooldown && "order" in action) {
    if ((entity.actionCooldowns?.[action.order] ?? 0) > 0) return false;
  }

  // Check mana
  if ("manaCost" in action && action.manaCost) {
    if ((entity.mana ?? 0) < action.manaCost) return false;
  }

  return true;
};

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

  // Check if action can be executed
  if (!canExecuteAction(entity, a)) return false;

  // Consume mana
  if ("manaCost" in a && a.manaCost && a.manaCost > 0 && entity.mana) {
    entity.mana -= a.manaCost;
  }

  if (
    "soundOnCastStart" in a && a.soundOnCastStart &&
    entity.position
  ) playSoundAt(entity.position, a.soundOnCastStart);

  return true;
};
