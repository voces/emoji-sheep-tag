import { z } from "npm:zod";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { UnknownEntity } from "../errors/UnknownEntity.ts";
import { zPoint } from "@/shared/zod.ts";
import { handleMove } from "./move.ts";
import { handleAttack } from "./attack.ts";
import { handleHold } from "./hold.ts";
import { getOrder } from "../orders/index.ts";
import { findActionAndItem, findActionByOrder } from "../util/actionLookup.ts";
import { playSound } from "../updates.ts";

export const zOrderEvent = z.object({
  type: z.literal("unitOrder"),
  units: z.string().array(),
  order: z.string(),
  target: z.union([zPoint, z.string()]).optional(),
});

export const unitOrder = (
  client: Client,
  { units, order, target }: z.TypeOf<typeof zOrderEvent>,
) => {
  for (const uId of units) {
    const unit = lookup(uId);
    if (!unit) throw new UnknownEntity(uId);
    if (client.id !== unit.owner) continue;

    // Find action from all possible sources
    const result = findActionAndItem(unit, order);
    if (!result) {
      console.warn("Action not found", { order, units, target });
      return;
    }

    const { action: _action, item: itemWithAction } = result;

    // Handle the action based on order type
    let actionResult;

    // Check if this order is handled by the new registry system
    const orderDef = getOrder(order);
    if (orderDef) {
      // Use new order system

      // Generic mana validation for all orders with mana costs
      const action = findActionByOrder(unit, order);
      if (action && action.type === "auto" && action.manaCost) {
        const manaCost = action.manaCost;
        if (manaCost > 0 && (unit.mana ?? 0) < manaCost) {
          console.warn(`Cannot execute order ${order} for unit ${unit.id}`);
          return;
        }
      }

      // Order-specific validation
      if (orderDef.canExecute && !orderDef.canExecute(unit)) return;

      if (orderDef.onIssue(unit) === "immediate") {
        if (action && "soundOnCastStart" in action && action.soundOnCastStart) {
          playSound(action.soundOnCastStart);
        }
      }
      actionResult = undefined;
    } else {
      // Fall back to legacy handlers
      switch (order) {
        case "move":
          actionResult = handleMove(unit, target);
          break;
        case "attack":
          actionResult = handleAttack(unit, target);
          break;
        case "stop":
          delete unit.queue;
          delete unit.order;
          actionResult = undefined;
          break;
        case "hold":
          actionResult = handleHold(unit);
          break;
        case "selfDestruct":
          unit.health = 0;
          actionResult = undefined;
          break;
        default:
          console.warn("Unhandled order type", { order, units, target });
          return;
      }
    }

    // Consume a charge if this action came from an item
    if (itemWithAction && itemWithAction.charges) {
      unit.inventory = unit.inventory?.map((i) =>
        i.id === itemWithAction.id
          ? { ...i, charges: (i.charges || 1) - 1 }
          : i
      ).filter((i) =>
        i.charges === undefined || i.charges > 0
      ) || [];
    }

    return actionResult;
  }
};
