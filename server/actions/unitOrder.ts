import { z } from "zod";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { zPoint } from "@/shared/zod.ts";
import { handleMove } from "./move.ts";
import { handleAttack } from "./attack.ts";
import { getOrder } from "../orders/index.ts";
import { findActionAndItem } from "@/shared/util/actionLookup.ts";
import { canExecuteAction, precast } from "../orders/precast.ts";
import { postCast } from "../orders/postCast.ts";
import { allowedToExecuteActionOnUnit } from "../util/allyPermissions.ts";

export const zOrderEvent = z.object({
  type: z.literal("unitOrder"),
  units: z.string().array(),
  order: z.string(),
  target: z.union([zPoint, z.string()]).optional(),
  queue: z.boolean().optional(),
  autocast: z.boolean().optional(),
  prefab: z.string().optional(),
});

export const unitOrder = (
  client: Client,
  { units, order, target, queue = false, autocast }: z.TypeOf<
    typeof zOrderEvent
  >,
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
    if (!allowedToExecuteActionOnUnit(client, unit, action)) {
      console.warn("Client lacks permission to execute action", {
        clientId: client.id,
        unitOwner: unit.owner,
        order,
      });
      continue;
    }

    // Check if this order is handled by the new registry system
    const orderDef = getOrder(order);

    // Handle autocast toggle (before other checks since it doesn't require execution)
    if (orderDef && typeof autocast === "boolean") {
      const currentAutocast = unit.autocast ?? [];
      const isEnabled = currentAutocast.includes(order);
      if (autocast && !isEnabled) {
        unit.autocast = [...currentAutocast, order];
      } else if (!autocast && isEnabled) {
        unit.autocast = currentAutocast.filter((o) => o !== order);
        if (!unit.autocast.length) delete unit.autocast;
      }
      continue;
    }

    // Check constructing, mana, gold, and cooldown (applies to all handlers)
    if (!canExecuteAction(unit, action)) continue;

    if (orderDef) {
      // Order-specific validation
      if (orderDef.canExecute && !orderDef.canExecute(unit, target)) continue;

      const issueResult = orderDef.onIssue(unit, target, queue);

      if (issueResult === "immediate") {
        if (!precast(unit, action)) continue;

        orderDef?.onCastStart?.(unit);

        // NOTE: remaining is ignored, so cast completes immediately after it starts
        orderDef.onCastComplete?.(unit);

        postCast(unit, itemWithAction, action);
      }
    } else {
      // Fall back to legacy handlers
      switch (order) {
        case "move":
          handleMove(unit, target, queue);
          break;
        case "attack":
          handleAttack(unit, target, queue, false);
          break;
        case "attack-ground":
          handleAttack(unit, target, queue, true);
          break;
        case "stop":
          if (!queue) {
            delete unit.queue;
            delete unit.order;
            if (unit.swing) delete unit.swing;
          }
          // Do nothing if stop is queued
          break;
        case "hold":
          if (queue) unit.queue = [...unit.queue ?? [], { type: "hold" }];
          else {
            delete unit.queue;
            if (unit.swing) delete unit.swing;
            unit.order = { type: "hold" };
          }
          break;
        default:
          console.warn("Unhandled order type", { order, units, target });
          continue;
      }
    }
  }
};
