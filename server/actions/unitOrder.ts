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
    switch (order) {
      case "move":
        return handleMove(unit, target);
      case "attack":
        return handleAttack(unit, target);
      case "hold":
        return handleHold(unit);
      case "destroyLastFarm":
        return handleDestroyLastFarm(unit);
      case "stop":
        delete unit.queue;
        delete unit.order;
        return;
      case "mirrorImage":
        return handleMirrorImage(unit);
      case "selfDestruct":
        return unit.health = 0;
      default:
        console.warn("unhandled order", { order, units, target });
    }
  }
};
