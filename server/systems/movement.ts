import { Entity, WalkAction } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  canSwing,
  distanceBetweenPoints,
  Point,
  withinRange,
} from "../../shared/pathing/math.ts";
import { calcPath, pathable } from "./pathing.ts";

const withinActionRange = (e: Entity, point: Point) => {
  if (e.action?.type !== "walk") return false;
  if (typeof e.action.target !== "string") {
    return e.action.target.x === point.x && e.action.target.y === point.y;
  }
  const target = lookup(e.action.target);
  if (!target) return false;
  if (e.action.attacking) return canSwing({ ...e, position: point }, target);
  return true;
};

const repath = (e: Entity): Entity => {
  if (e.action?.type !== "walk") return e;

  // If attacking-walking, skip to attack if within range
  if (e.action.attacking && typeof e.action.target === "string") {
    const target = lookup(e.action.target);
    if (target && withinRange(e, target, e.attack?.range ?? 0)) {
      delete e.action;
      return e;
    }
  }

  // Otherwise compute the path
  let newPath = calcPath(
    e,
    e.action.target,
    {
      mode: e.action.attacking ? "attack" : undefined,
      distanceFromTarget: e.action.distanceFromTarget,
    },
  ).slice(1);

  // Same path, try to recalculate without moving entities (IDK what this fixed)
  if (
    newPath.length === e.action.path.length &&
    e.action.path.every((p, i) =>
      p.x === newPath[i].x && p.y === newPath[i].y
    ) &&
    (newPath.length === 0 ||
      !withinActionRange(e, newPath.at(-1)!) || !pathable(e, newPath.at(-1)))
  ) {
    newPath = calcPath(
      e,
      e.action.target,
      {
        mode: e.action.attacking ? "attack" : undefined,
        removeMovingEntities: false,
        distanceFromTarget: e.action.distanceFromTarget,
      },
    ).slice(1);
  }

  // No path, kill action
  if (
    newPath.length < 1 ||
    newPath.length === 1 && newPath[0].x === e.position?.x &&
      newPath[0].y === e.position.y
  ) {
    if (isFollowing(e.action)) return e;
    delete e.action;
    return e;
  }

  // New path!
  e.action = {
    ...e.action,
    target: typeof e.action.target === "string"
      ? e.action.target
      : newPath.at(-1) ?? e.action.target,
    path: newPath,
  };

  return e;
};

const isFollowing = (action: WalkAction) =>
  !action.attacking && typeof action.target === "string" &&
  !!lookup(action.target);

export const advanceMovement = (e: Entity, delta: number): number => {
  if (e.action?.type !== "walk") return delta;

  if (typeof e.action.target === "string") e = repath(e);
  if (e.action?.type !== "walk") return delta;

  // If movement not possible, clear action
  if (!e.position || !e.movementSpeed) {
    delete e.action;
    return delta;
  }

  // At the end!
  if (e.action.path.length === 0) {
    if (isFollowing(e.action)) return 0;

    delete e.action;
    return delta;
  }

  const finalTarget = typeof e.action.target === "string"
    ? lookup(e.action.target)
    : e.action.target;

  // Invalid target
  if (!finalTarget) {
    delete e.action;
    return delta;
  }

  // Immediately attack if attacking & ready to swing
  if (
    "id" in finalTarget && !isFollowing(e.action) &&
    canSwing(e, finalTarget, true)
  ) {
    delete e.action;
    return delta;
  }

  // At the end! (with range)
  if (
    e.action.distanceFromTarget &&
    withinRange(e, finalTarget, e.action.distanceFromTarget)
  ) {
    if (isFollowing(e.action)) return 0;

    delete e.action;
    return delta;
  }

  let target = e.action.path[0];

  let movement = e.movementSpeed * delta;

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;

  // End of segment
  while (p > 1) {
    delta -= remaining / e.movementSpeed;

    // End of path
    if (e.action.path.length === 1) {
      // If end position isn't pathable, try to repath
      if (!pathable(e, target)) {
        e = repath(e);
        return e.action?.type === "walk" && isFollowing(e.action) ? 0 : delta;
      }

      // Update end position
      e.position = { ...target };

      // Repath if we're targeting something (attacking or following a unit)
      if (typeof e.action.target === "string") {
        e = repath(e);
        return e.action?.type === "walk" && isFollowing(e.action) ? 0 : delta;
      }

      // If we're not targeting something, we reached the end; advance
      delete e.action;
      return delta;
    }

    // Not end of path, advance along it
    movement -= remaining;
    [last, target] = e.action.path;
    e.action = { ...e.action, path: e.action.path.slice(1) };
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

  // If end position isn't pathable, try to repath
  if (!pathable(e, newPosition)) {
    e = repath(e);
    return delta;
  }

  e.position = newPosition;

  return delta;
};
