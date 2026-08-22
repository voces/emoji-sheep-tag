import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "@/shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "@/shared/pathing/math.ts";
import {
  accelerate,
  computeUnitMovementSpeed,
  turnSpeedCap,
} from "@/shared/api/unit.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { clearDebugRings, updateDebugRings } from "../util/pathingDebug.ts";
import { blockedByGeometry } from "./pathing.ts";

const stalled = new WeakSet<Entity>();

/**
 * Whether the entity holds a path it cannot currently advance along, because
 * something is standing in the way. Such a unit keeps its walk order, so it
 * would otherwise be animated running on the spot.
 */
export const isStalled = (e: Entity): boolean => stalled.has(e);

const tweenPath = (e: Entity, delta: number): number => {
  if (
    !e.order || !("path" in e.order) || !e.order.path?.length ||
    !e.position || !e.movementSpeed
  ) return 0;

  // The server has it held behind something in the way. Predicting it forward
  // would only have to be undone, and the further it went the worse the undoing
  // looks, so it stands still until told otherwise.
  if (e.blocked) {
    stalled.add(e);
    return 0;
  }

  let target = e.order.path[0];

  // Same ramp the server applies, so a unit setting off is not predicted at
  // full speed and then pulled back.
  const max = computeUnitMovementSpeed(e);
  const ramped = accelerate(e.speed ?? 0, max, delta);
  e.speed = ramped.speed;

  const effectiveMovementSpeed = ramped.distance / delta;
  let movement = ramped.distance;
  if (!effectiveMovementSpeed) return 0;

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;

  // End of segment
  while (p > 1) {
    delta -= remaining / effectiveMovementSpeed;

    // End of path
    if (e.order.path?.length === 1) {
      // Only the ground stops it; another unit in the way is left to the
      // server, which knows where everything really is.
      if (blockedByGeometry(e, target)) {
        stalled.add(e);
        return delta;
      }

      // Update end position
      stalled.delete(e);
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

  if (blockedByGeometry(e, newPosition)) {
    stalled.add(e);
    return delta;
  }

  stalled.delete(e);
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
          lookup(e.order.targetId)?.position ||
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

        // Same cornering cost the server applies.
        if (e.speed) {
          e.speed = Math.min(
            e.speed,
            turnSpeedCap(computeUnitMovementSpeed(e), diff),
          );
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

      // If order has a path, tween along it; otherwise break (nothing more to do)
      if ("path" in e.order && e.order.path?.length) {
        delta = tweenPath(e, delta);
      } else {
        break;
      }
    }

    updateDebugRings(e);
  },
  onRemove: clearDebugRings,
});
