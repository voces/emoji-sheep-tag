import { z } from "zod";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { zPoint } from "@/shared/zod.ts";
import { getOrder } from "../orders/index.ts";
import { findActionAndItem } from "@/shared/util/actionLookup.ts";
import { canExecuteAction, precast } from "../orders/precast.ts";
import { postCast } from "../orders/postCast.ts";
import { allowedToExecuteActionOnUnit } from "../util/allyPermissions.ts";
import { Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";

const isAlreadyCasting = (
  unit: Entity,
  orderId: string,
  target: Point | string | undefined,
): boolean =>
  unit.order?.type === "cast" &&
  unit.order.orderId === orderId &&
  (typeof target === "string"
    ? "targetId" in unit.order && unit.order.targetId === target
    : "target" in unit.order &&
      unit.order.target?.x === target?.x &&
      unit.order.target?.y === target?.y);

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

    const orderDef = getOrder(order);

    // Handle autocast toggle (before other checks since it doesn't require execution)
    if (typeof autocast === "boolean") {
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

    // Check constructing, mana, gold, and cooldown
    if (!canExecuteAction(unit, action)) continue;

    // Order-specific validation
    if (orderDef.canExecute && !orderDef.canExecute(unit, target)) continue;

    // Already casting this order on same target - ignore
    if (!queue && isAlreadyCasting(unit, order, target)) continue;

    if (orderDef.onIssue(unit, target, queue) === "immediate") {
      if (!precast(unit, action)) continue;

      orderDef.onCastStart?.(unit);

      // NOTE: remaining is ignored, so cast completes immediately after it starts
      orderDef.onCastComplete?.(unit);

      postCast(unit, itemWithAction, action);
    }
  }
};
