import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "@/shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "@/shared/pathing/math.ts";
import { computeUnitMovementSpeed } from "@/shared/api/unit.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { clearDebugCircles, updateDebugCircles } from "../util/pathingDebug.ts";
import { pathable } from "./pathing.ts";

const tweenPath = (e: Entity, delta: number): number => {
  if (
    !e.order || !("path" in e.order) || !e.order.path?.length ||
    !e.position || !e.movementSpeed
  ) return 0;

  let target = e.order.path[0];
  const effectiveMovementSpeed = computeUnitMovementSpeed(e);
  let movement = effectiveMovementSpeed * delta;

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;

  // End of segment
  while (p > 1) {
    delta -= remaining / effectiveMovementSpeed;

    // End of path
    if (e.order.path?.length === 1) {
      // If end position isn't pathable, do nothing
      if (!pathable(e, target)) return delta;

      // Update end position
      e.position = { ...target };
      const { path: _path, ...rest } = e.order;
      e.order = rest;
      return delta;
    }

    // Not end of path, advance along it
    movement -= remaining;
    [last, target] = e.order.path ?? [];
    e.order = { ...e.order, path: e.order.path?.slice(1) };
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
  if (!pathable(e, newPosition)) return delta;

  e.position = newPosition;
  return delta;
};

app.addSystem({
  props: ["order"],
  updateEntity: (e, delta) => {
    let loops = 10;
    while ((e.order || e.queue?.length) && delta > 0) {
      if (!loops--) {
        console.warn("Over 10 order loops!", e.id, e.order, delta);
        break;
      }

      // Advance queue
      if (!e.order) {
        if (e.queue && e.queue.length > 0) {
          if (e.queue.length > 1) [e.order, ...e.queue] = e.queue;
          else {
            e.order = e.queue[0];
            delete e.queue;
          }
        } else break;
      }

      // Turn; consume delta if target point is outside angle of attack (±60°)
      const lookTarget = "path" in e.order && e.order.path?.[0] ||
        "targetId" in e.order && e.order.targetId &&
          lookup[e.order.targetId]?.position ||
        "target" in e.order && e.order.target ||
        ("x" in e.order && "y" in e.order && { x: e.order.x, y: e.order.y }) ||
        undefined;

      if (
        lookTarget &&
        (lookTarget.x !== e.position?.x || lookTarget.y !== e.position.y) &&
        e.turnSpeed && e.position
      ) {
        const facing = e.facing ?? DEFAULT_FACING;
        const targetAngle = Math.atan2(
          lookTarget.y - e.position.y,
          lookTarget.x - e.position.x,
        );
        const diff = Math.abs(angleDifference(facing, targetAngle));
        if (diff > 1e-07) {
          const maxTurn = e.turnSpeed * delta;
          e.facing = tweenAbsAngles(facing, targetAngle, maxTurn);
        }
        if (diff > MAX_ATTACK_ANGLE) {
          delta = Math.max(
            0,
            delta - (diff - MAX_ATTACK_ANGLE) / e.turnSpeed,
          );
        }
      }

      // Abort if delta consumed turning
      if (delta === 0) break;

      delta = "path" in e.order && e.order.path?.length
        ? tweenPath(e, delta)
        : 0;
    }

    updateDebugCircles(e);
  },
  onRemove: clearDebugCircles,
});
