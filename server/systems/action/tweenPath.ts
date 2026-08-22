import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { accelerate, computeUnitMovementSpeed } from "@/shared/api/unit.ts";
import { blockers, pathable } from "../pathing.ts";

type TweenPathResult = {
  delta: number;
  pathBlocked: boolean;
  /** Entities occupying the position the tween could not advance into. */
  blockers: Entity[];
};

export const tweenPath = (e: Entity, delta: number): TweenPathResult => {
  const originalDelta = delta;
  if (
    !e.order || !("path" in e.order) || !e.order.path?.length ||
    !e.position || !e.movementSpeed
  ) return { delta, pathBlocked: false, blockers: [] };

  let target = e.order.path[0];

  // Ramping up to speed rather than starting at it, so setting off and the
  // turns that stop a unit both cost a little ground. The rest of the walk is
  // in terms of distance and time, so the ramp is folded into the speed used to
  // convert between them.
  const max = computeUnitMovementSpeed(e);
  const ramped = accelerate(e.speed ?? 0, max, delta);
  e.speed = ramped.speed;

  const effectiveMovementSpeed = ramped.distance / delta;
  let movement = ramped.distance;
  if (!effectiveMovementSpeed) {
    return { delta: 0, pathBlocked: false, blockers: [] };
  }

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;
  let newPath: typeof e.order.path | undefined;

  // End of segment
  while (p > 1) {
    delta -= remaining / effectiveMovementSpeed;

    // End of path
    if (e.order.path?.length === 1) {
      // If end position isn't pathable, do nothing
      if (!pathable(e, target)) {
        return {
          delta: originalDelta,
          pathBlocked: true,
          blockers: blockers(e, target),
        };
      }

      // Update end position
      if (e.blocked) delete e.blocked;
      e.position = { ...target };
      return { delta, pathBlocked: false, blockers: [] };
    }

    // Not end of path, advance along it
    movement -= remaining;
    [last, target] = e.order.path ?? [];
    // Don't modify path yet - wait until we confirm the move is valid
    newPath = e.order.path?.slice(1);
    remaining = distanceBetweenPoints(target, last);
    p = movement / remaining;
  }

  delta -= movement / effectiveMovementSpeed;

  const newPosition = p < 1
    ? {
      x: last.x * (1 - p) + target.x * p,
      y: last.y * (1 - p) + target.y * p,
    }
    : {
      x: target.x,
      y: target.y,
    };

  // If end position isn't pathable, do nothing
  if (!pathable(e, newPosition)) {
    return {
      delta: originalDelta,
      pathBlocked: true,
      blockers: blockers(e, newPosition),
    };
  }

  // Only now that we've confirmed the move is valid, update the path if we advanced along it
  if (typeof newPath !== "undefined") {
    e.order = { ...e.order, path: newPath };
  }

  if (e.blocked) delete e.blocked;
  e.position = newPosition;
  return { delta, pathBlocked: false, blockers: [] };
};
