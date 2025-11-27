import { DEFAULT_FACING } from "@/shared/constants.ts";
import { Order, SystemEntity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { pathingMap } from "../systems/pathing.ts";

export const foxOrder = {
  id: "fox",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "fox");
    const castDuration =
      (action?.type === "auto" ? action.castDuration : undefined) ?? 0.3;
    const order: Order = {
      type: "cast",
      orderId: "fox",
      remaining: castDuration,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastComplete: (unit) => {
    if (!unit.owner || !unit.position) return false;

    const action = findActionByOrder(unit, "fox");
    if (!action) return false;

    const angle = unit.facing ?? DEFAULT_FACING;
    const p = pathingMap();
    const layer = p.layer(unit.position.x, unit.position.y);
    const fox = newUnit(unit.owner, "fox", Infinity, Infinity, {
      facing: angle,
    });
    const pos1 = p.nearestSpiralPathing(
      unit.position.x + Math.cos(angle) * 1.125,
      unit.position.y + Math.sin(angle) * 1.125,
      fox as SystemEntity<"position" | "radius">,
    );
    fox.position = p.nearestSpiralPathing(
      pos1.x,
      pos1.y,
      fox as SystemEntity<"position" | "radius">,
      layer,
    );

    // Get lifetime duration from the action definition
    const lifetime = action.type === "auto" ? action.buffDuration : undefined;
    if (lifetime) {
      fox.buffs = [{
        remainingDuration: lifetime,
        totalDuration: lifetime,
        expiration: "Fox",
      }];
    }

    if (unit.trueOwner) fox.trueOwner = unit.trueOwner;
  },
} satisfies OrderDefinition;
