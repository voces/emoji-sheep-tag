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
import { currentApp } from "../contexts.ts";

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
  console.log("unitOrder", { units, order, target });
  for (const uId of units) {
    const unit = lookup(uId);
    if (!unit) throw new UnknownEntity(uId);
    if (client.id !== unit.owner) continue;

    // Find action from all possible sources
    const result = findActionAndItem(unit, order);
    if (!result) {
      console.warn("Action not found", { order, units, target });
      continue;
    }

    const { action: _action, item: itemWithAction } = result;

    // Handle the action based on order type

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
          continue;
        }
      }

      // Order-specific validation
      if (orderDef.canExecute && !orderDef.canExecute(unit)) continue;

      if (orderDef.onIssue(unit) === "immediate") {
        if (
          action && "soundOnCastStart" in action && action.soundOnCastStart &&
          unit.position && unit.owner
        ) {
          const app = currentApp();
          app.addEntity({
            id: `sound-${Date.now()}-${Math.random()}`,
            owner: unit.owner,
            position: { x: unit.position.x, y: unit.position.y },
            sounds: {
              birth: [action.soundOnCastStart],
            },
            buffs: [{
              remainingDuration: 0.1,
              expiration: "Sound",
            }],
          });
        }
      }
    } else {
      // Fall back to legacy handlers
      switch (order) {
        case "move":
          handleMove(unit, target);
          break;
        case "attack":
          handleAttack(unit, target);
          break;
        case "stop":
          delete unit.queue;
          delete unit.order;
          break;
        case "hold":
          handleHold(unit);
          break;
        case "selfDestruct":
          unit.health = 0;
          unit.lastAttacker = null;
          break;
        default:
          console.warn("Unhandled order type", { order, units, target });
          continue;
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
  }
};
