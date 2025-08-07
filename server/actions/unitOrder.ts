import { z } from "npm:zod";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { UnknownEntity } from "../errors/UnknownEntity.ts";
import { zPoint } from "../../shared/zod.ts";
import { handleMove } from "./move.ts";
import { handleAttack } from "./attack.ts";
import { handleHold } from "./hold.ts";
import { handleDestroyLastFarm } from "../st/destroyLastFarm.ts";
import { handleMirrorImage } from "./mirrorImage.ts";
import { handleFox } from "./fox.ts";
import { findActionAndItem } from "../util/actionLookup.ts";

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

    const { action, item: itemWithAction } = result;

    // Handle the action based on order type
    let actionResult;
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
      case "destroyLastFarm":
        actionResult = handleDestroyLastFarm(unit);
        break;
      case "selfDestruct":
        unit.health = 0;
        actionResult = undefined;
        break;
      case "mirrorImage":
        actionResult = handleMirrorImage(unit);
        break;
      case "fox":
        // TODO: subtract charge count when order actually consumed
        actionResult = handleFox(unit, action);
        break;
      default:
        console.warn("Unhandled order type", { order, units, target });
        return;
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
