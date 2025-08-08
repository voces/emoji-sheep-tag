import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { pathable } from "../pathing.ts";

export const tweenPath = (e: Entity, delta: number): number => {
  if (
    !e.order || !("path" in e.order) || !e.order.path?.length ||
    !e.position || !e.movementSpeed
  ) return delta;

  let target = e.order.path[0];
  let movement = e.movementSpeed * delta;

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;

  // End of segment
  while (p > 1) {
    delta -= remaining / e.movementSpeed;

    // End of path
    if (e.order.path?.length === 1) {
      // If end position isn't pathable, do nothing
      if (!pathable(e, target)) return delta;

      // Update end position
      e.position = { ...target };
      return delta;
    }

    // Not end of path, advance along it
    movement -= remaining;
    [last, target] = e.order.path ?? [];
    e.order = { ...e.order, path: e.order.path?.slice(1) };
    remaining = distanceBetweenPoints(target, last);
    p = movement / remaining;
  }

  delta -= movement / e.movementSpeed;

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
  if (!pathable(e, newPosition)) return delta;

  e.position = newPosition;
  return delta;
};
