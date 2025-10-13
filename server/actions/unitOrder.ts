import { z } from "zod";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { zPoint } from "@/shared/zod.ts";
import { handleMove } from "./move.ts";
import { handleAttack } from "./attack.ts";
import { getOrder } from "../orders/index.ts";
import { findActionAndItem, findActionByOrder } from "../util/actionLookup.ts";
import { precast } from "../orders/precast.ts";
import { postCast } from "../orders/postCast.ts";
import { canExecuteActionOnUnit } from "../util/allyPermissions.ts";

export const zOrderEvent = z.object({
  type: z.literal("unitOrder"),
  units: z.string().array(),
  order: z.string(),
  target: z.union([zPoint, z.string()]).optional(),
  queue: z.boolean().optional(),
});

export const unitOrder = (
  client: Client,
  { units, order, target, queue = false }: z.TypeOf<typeof zOrderEvent>,
) => {
  for (const uId of units) {
    const unit = lookup(uId);
    if (!unit) return;

    // Find action from all possible sources
    const result = findActionAndItem(unit, order);
    if (!result) {
      console.warn("Action not found", { order, units, target });
      continue;
    }

    const { action, item: itemWithAction } = result;

    // Check if client can execute this action on this unit
    if (!canExecuteActionOnUnit(client, unit, action)) {
      console.warn("Client lacks permission to execute action", {
        clientId: client.id,
        unitOwner: unit.owner,
        order,
      });
      continue;
    }

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
      if (orderDef.canExecute && !orderDef.canExecute(unit, target)) continue;

      const issueResult = orderDef.onIssue(unit, target, queue);

      if (issueResult === "immediate") {
        if (!precast(unit, false, order)) continue;

        orderDef?.onCastStart?.(unit);

        // NOTE: remaining is ignored, so cast completes immediately after it starts
        orderDef.onCastComplete?.(unit);

        postCast(unit, itemWithAction, order);
      }
    } else {
      // Fall back to legacy handlers
      switch (order) {
        case "move":
          handleMove(unit, target, queue);
          break;
        case "attack":
          handleAttack(unit, target, queue);
          break;
        case "stop":
          if (!queue) {
            delete unit.queue;
            delete unit.order;
          }
          // Do nothing if stop is queued
          break;
        case "hold":
          if (queue) unit.queue = [...unit.queue ?? [], { type: "hold" }];
          else {
            delete unit.queue;
            unit.order = { type: "hold" };
          }
          break;
        case "selfDestruct":
          // TODO: queue, but right now things that support self destruct can't
          // do anything else, so queueing does nothing
          unit.lastAttacker = null;
          unit.health = 0;
          break;
        default:
          console.warn("Unhandled order type", { order, units, target });
          continue;
      }
    }
  }
};
