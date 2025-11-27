import { lookup } from "../lookup.ts";
import { FOLLOW_DISTANCE } from "@/shared/constants.ts";
import { isAlive } from "../../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { handleBlockedPath, shouldRepath } from "./pathRetry.ts";
import { angleDifference } from "@/shared/pathing/math.ts";

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
    if (!path.length && e.turnSpeed) {
      // If there's no path, keep the order so the unit at least turns to face the target
      e.order = { ...e.order, path: [], lastRepath: now };
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
  if (e.order.path && "target" in e.order) {
    // If path has points and we've reached the end, clear the order
    if (
      e.order.path.length > 0 &&
      e.order.path.at(-1)?.x === e.position?.x &&
      e.order.path.at(-1)?.y === e.position?.y
    ) delete e.order;
    // If path is empty (unreachable target), check if facing is complete
    else if (
      e.order.path.length === 0 && e.position && typeof e.facing === "number" &&
      e.turnSpeed
    ) {
      const dx = e.order.target.x - e.position.x;
      const dy = e.order.target.y - e.position.y;
      const targetAngle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDifference(e.facing, targetAngle));

      // Clear order when facing is close enough (within ~0.01 radians)
      if (diff < 0.01) delete e.order;

      const maxTurn = e.turnSpeed * delta;
      return Math.max(0, tweenResult.delta - (diff - maxTurn) / e.turnSpeed);
    }
  }

  return tweenResult.delta;
};
