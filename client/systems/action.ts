import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { clearDebugCircles, updateDebugCircles } from "../util/pathingDebug.ts";
import { pathable } from "./pathing.ts";

const tweenPath = (e: Entity, delta: number): number => {
  if (
    !e.action || !("path" in e.action) || !e.action.path?.length ||
    !e.position || !e.movementSpeed
  ) return 0;

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
    if (e.action.path?.length === 1) {
      // If end position isn't pathable, do nothing
      if (!pathable(e, target)) return delta;

      // Update end position
      e.position = { ...target };
      const { path: _path, ...rest } = e.action;
      e.action = rest;
      return delta;
    }

    // Not end of path, advance along it
    movement -= remaining;
    [last, target] = e.action.path ?? [];
    e.action = { ...e.action, path: e.action.path?.slice(1) };
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

app.addSystem({
  props: ["action"],
  onChange: (e) => {
    if (e.action?.type !== "attack" && e.swing) delete e.swing;
  },
  updateEntity: (e, delta) => {
    let loops = 1000;
    while ((e.action || e.queue?.length) && delta > 0) {
      console.log("action", e.id, e.action.type);

      if (!loops--) {
        console.warn("Over 1000 action loops!", e.id, e.action, delta);
        break;
      }

      // Advance queue
      if (!e.action) {
        if (e.queue && e.queue.length > 0) {
          if (e.queue.length > 1) [e.action, ...e.queue] = e.queue;
          else {
            e.action = e.queue[0];
            delete e.queue;
          }
        } else break;
      }

      // Turn; consume delta if target point is outside angle of attack (±60°)
      const lookTarget = "path" in e.action && e.action.path?.[0] ||
        "targetId" in e.action && e.action.targetId &&
          lookup[e.action.targetId]?.position ||
        "target" in e.action && e.action.target || undefined;

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

      delta = "path" in e.action && e.action.path?.length
        ? tweenPath(e, delta)
        : 0;
    }

    updateDebugCircles(e);
  },
  onRemove: clearDebugCircles,
});
