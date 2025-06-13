import { Entity, WalkAction } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  angleDifference,
  canSwing,
  distanceBetweenPoints,
  tweenAbsAngles,
  withinRange,
} from "../../shared/pathing/math.ts";
import { calcPath, pathable } from "./pathing.ts";
import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import { advanceAttack } from "./attack.ts";
import { advanceBuild } from "./build.ts";
import { absurd } from "../../shared/util/absurd.ts";
import { onInit } from "../ecs.ts";

const repath = (e: Entity) => {
  if (e.action?.type !== "walk") return;

  // If attacking-walking, skip to attack if within range
  if (e.action.attacking && typeof e.action.target === "string") {
    const target = lookup(e.action.target);
    if (target && withinRange(e, target, e.attack?.range ?? 0)) {
      return delete e.action;
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

  // Same path, try to recalculate with moving entities (IDK what this fixed)
  if (
    newPath.length === e.action.path.length &&
    e.action.path.every((p, i) => p.x === newPath[i].x && p.y === newPath[i].y)
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
  ) return delete e.action;

  // New path!
  e.action = { ...e.action, path: newPath };
};

const isFollowing = (action: WalkAction) =>
  !action.attacking && typeof action.target === "string" &&
  !!lookup(action.target);

export const advanceMovement = (e: Entity, delta: number): number => {
  if (e.action?.type !== "walk") return delta;

  if (typeof e.action.target === "string") repath(e);
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

  // Turn; consume delta if target point is outside angle of attack (±60°)
  if (e.turnSpeed) {
    const facing = e.facing ?? DEFAULT_FACING;
    const targetAngle = Math.atan2(
      target.y - e.position.y,
      target.x - e.position.x,
    );
    const diff = Math.abs(angleDifference(facing, targetAngle));
    if (diff > 1e-07) {
      const maxTurn = e.turnSpeed * delta;
      e.facing = diff < maxTurn
        ? targetAngle
        : tweenAbsAngles(facing, targetAngle, maxTurn);
    }
    if (diff > MAX_ATTACK_ANGLE) {
      delta = Math.max(0, delta - (diff - MAX_ATTACK_ANGLE) / e.turnSpeed);
    }
  }

  // If all of delta is consumed by turning, we can stop here
  if (delta === 0) return 0;

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
      if (!pathable(e, target)) return (repath(e), delta);

      // Update end position
      e.position = { ...target };

      // Repath if we're targeting something (attacking or following a unit)
      if (typeof e.action.target === "string") return (repath(e), delta);

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
  if (!pathable(e, newPosition)) return (repath(e), delta);

  e.position = newPosition;

  return delta;
};

onInit((app) => {
  app.addSystem({
    props: ["action"],
    updateEntity: (e, delta) => {
      let attackCooldownAvailable = delta;

      let loops = 1000;
      while ((e.action || e.queue?.length) && delta > 0) {
        if (!loops--) {
          console.warn("Over 1000 action loops!", e.action);
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

        // Reduce attack cooldown, which does not consume delta
        if (e.attackCooldownRemaining && attackCooldownAvailable) {
          const consumed = Math.min(
            e.attackCooldownRemaining,
            attackCooldownAvailable,
          );
          if (e.attackCooldownRemaining === consumed) {
            delete e.attackCooldownRemaining;
          } else e.attackCooldownRemaining -= consumed;
          attackCooldownAvailable -= consumed;
        }

        switch (e.action.type) {
          // TODO: consolidate turning
          case "attack":
            delta = advanceAttack(e, delta);
            break;
          case "build":
            delta = advanceBuild(e, delta);
            break;
          case "hold":
            delta = 0;
            break;
          case "walk":
            delta = advanceMovement(e, delta);
            break;
          default:
            absurd(e.action);
        }
      }
    },
  });
});
