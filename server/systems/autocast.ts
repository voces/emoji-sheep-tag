import { addSystem } from "@/shared/context.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { getOrder } from "../orders/index.ts";
import { canExecuteAction, precast } from "../orders/precast.ts";
import { postCast } from "../orders/postCast.ts";
import { Order } from "@/shared/types.ts";
import { findAutoTarget } from "@/shared/util/autoTargeting.ts";
import { hasBuff } from "@/shared/api/unit.ts";

addSystem({
  props: ["autocast", "position"],
  updateEntity: (unit) => {
    // Skip if unit is busy
    if (unit.order) return;

    for (const orderId of unit.autocast) {
      const action = findActionByOrder(unit, orderId);
      if (!action || action.type !== "auto") continue;

      // Check constructing, mana, gold, and cooldown
      if (!canExecuteAction(unit, action)) continue;

      // Don't default the range; do nothing instead?
      const range = action.range ?? 5;
      const targeting = action.targeting;
      const buffName = action.buffName;

      // Find a valid target that doesn't already have the buff
      const target = findAutoTarget(
        unit,
        range,
        targeting,
        buffName,
        unit.owner,
      );
      if (!target) continue;
      if (buffName && hasBuff(target, buffName)) continue;

      // Issue the order
      const orderDef = getOrder(orderId);
      if (!orderDef) continue;

      const castDuration = action.castDuration ?? 0;

      // Should we issue an order instead?
      const order: Order = {
        type: "cast",
        orderId,
        remaining: castDuration,
        targetId: target.id,
      };

      unit.order = order;

      // If it's an immediate cast, execute it now and clear order
      if (castDuration === 0) {
        if (!precast(unit, action)) {
          delete unit.order;
          continue;
        }
        orderDef.onCastStart?.(unit);
        orderDef.onCastComplete?.(unit);
        postCast(unit, undefined, action);
        delete unit.order;
      }

      // Only issue one autocast per frame
      break;
    }
  },
});
