import { lookup } from "../lookup.ts";
import { FOLLOW_DISTANCE } from "@/shared/constants.ts";
import { isAlive } from "../../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { handleBlockedPath, shouldRepath } from "./pathRetry.ts";

export const advanceWalk = (e: Entity, delta: number): number => {
  if (e.order?.type !== "walk") return delta;

  const now = Date.now() / 1000;

  // Continuously repath for moving targets (targetId)
  if ("targetId" in e.order) {
    const target = lookup(e.order.targetId);
    if (!target || !isAlive(target)) {
      delete e.order;
      return delta;
    }

    // Always recompute for moving targets
    const path = calcPath(e, e.order.targetId, {
      distanceFromTarget: FOLLOW_DISTANCE,
    });
    if (!path.length) {
      delete e.order;
      return delta;
    }
    e.order = { ...e.order, path, lastRepath: now };
  } else if (!e.order.path || shouldRepath(e, now)) {
    // Periodic repath for static targets
    const path = calcPath(e, e.order.target);
    if (!path.length) {
      delete e.order;
      return delta;
    }
    e.order = { ...e.order, path, lastRepath: now };
  }

  const tweenResult = tweenPath(e, delta);

  if (tweenResult.pathBlocked && e.order.path) {
    const target = "targetId" in e.order ? e.order.targetId : e.order.target;
    const options = "targetId" in e.order
      ? { distanceFromTarget: FOLLOW_DISTANCE }
      : undefined;

    if (handleBlockedPath(e, target, e.order.path, options)) {
      delete e.order;
      return delta;
    }
    return delta;
  }

  // Reached end
  if (
    e.order.path && (!e.order.path.length ||
      (e.order.path.at(-1)?.x === e.position?.x &&
        e.order.path.at(-1)?.y === e.position?.y)) &&
    "target" in e.order
  ) delete e.order;

  return tweenResult.delta;
};
