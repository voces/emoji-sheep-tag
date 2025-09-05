import { Entity } from "@/shared/types.ts";
import { getOrder } from "../../orders/index.ts";
import { findActionAndItem } from "../../util/actionLookup.ts";
import { tweenPath } from "./tweenPath.ts";
import {
  distanceBetweenEntities,
  distanceBetweenPoints,
} from "@/shared/pathing/math.ts";
import { calcPath } from "../pathing.ts";
import { lookup } from "../lookup.ts";
import { precast } from "../../orders/precast.ts";
import { postCast } from "../../orders/postCast.ts";

export const advanceCast = (e: Entity, delta: number): number => {
  // console.log("advance1");
  if (e.order?.type !== "cast") return delta;
  // console.log("advance2");
  const { action, item } = findActionAndItem(e, e.order.orderId) ?? {};

  // Handle movement for cast orders with target and range
  const range = action?.type === "target" ? action.range : undefined;
  const target = e.order.target ??
    (e.order.targetId ? lookup(e.order.targetId) : undefined);
  if (range !== undefined && target) {
    if (!e.position) {
      delete e.order;
      return delta;
    }

    const dist = "x" in target
      ? distanceBetweenPoints(e.position, target)
      : distanceBetweenEntities(e, target);
    if (dist > range) {
      // Out of range - need to move closer
      const path = calcPath(e, "x" in target ? target : target.id, {
        distanceFromTarget: range,
      });

      if (!path.length) {
        // Can't reach target, fail the order
        delete e.order;
        return delta;
      }
      e.order = { ...e.order, path };

      // Tween along the path
      return tweenPath(e, delta);
    }
  }

  // console.log("advance3");

  if ("path" in e.order) {
    const { path: _path, ...rest } = e.order;
    e.order = { ...rest };
  }

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    // console.log("advance start");
    const orderDef = getOrder(e.order.orderId);

    if (!precast(e)) {
      // console.log("advance bad precast");
      delete e.order;
      return delta;
    }

    orderDef?.onCastStart?.(e);

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }
  // console.log("advance4");
  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;
  // console.log("advance5");
  if (getOrder(e.order.orderId)?.onCastComplete?.(e) === false) return delta;
  // console.log("advance6");
  postCast(e, item);

  delete e.order;

  return delta;
};
