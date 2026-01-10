import { Entity } from "@/shared/types.ts";
import { getOrder } from "../../orders/index.ts";
import { findActionAndItem } from "@/shared/util/actionLookup.ts";
import { tweenPath } from "./tweenPath.ts";
import {
  distanceBetweenEntities,
  distanceBetweenPoints,
} from "@/shared/pathing/math.ts";
import { calcPath } from "../pathing.ts";
import { lookup } from "../lookup.ts";
import { precast } from "../../orders/precast.ts";
import { postCast } from "../../orders/postCast.ts";
import { handleBlockedPath } from "./pathRetry.ts";
import { canSee } from "@/shared/api/unit.ts";

export const advanceCast = (e: Entity, delta: number): number => {
  if (e.order?.type !== "cast") return delta;
  const { action, item } = findActionAndItem(e, e.order.orderId) ?? {};

  // Cancel if entity target is no longer visible
  if (e.order.targetId) {
    const entityTarget = lookup(e.order.targetId);
    if (!entityTarget || !canSee(e, entityTarget)) {
      delete e.order;
      return delta;
    }
  }

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
      if (!e.order.path) {
        const path = calcPath(e, "x" in target ? target : target.id, {
          distanceFromTarget: range,
        });
        if (!path.length) {
          const currentDist = "x" in target
            ? distanceBetweenPoints(e.position, target)
            : distanceBetweenEntities(e, target);
          if (currentDist > range) {
            // Target unreachable and out of cast range
            delete e.order;
            return delta;
          }
          // Within cast range but can't path closer - proceed without path
          return delta;
        }
        e.order = { ...e.order, path };
      }

      const tweenResult = tweenPath(e, delta);

      if (tweenResult.pathBlocked && e.order.path) {
        const targetRef = "x" in target ? target : target.id;
        if (
          handleBlockedPath(e, targetRef, e.order.path, {
            distanceFromTarget: range,
          })
        ) {
          delete e.order;
          return delta;
        }
        return delta;
      }

      return tweenResult.delta;
    }
  }

  if ("path" in e.order) {
    const { path: _path, ...rest } = e.order;
    e.order = { ...rest };
  }

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    const orderDef = getOrder(e.order.orderId);

    if (!precast(e)) {
      delete e.order;
      return delta;
    }

    orderDef?.onCastStart?.(e);

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }
  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  if (getOrder(e.order.orderId)?.onCastComplete?.(e) === false) return delta;

  postCast(e, item);

  delete e.order;

  return delta;
};
