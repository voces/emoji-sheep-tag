import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { absurd } from "../../shared/util/absurd.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";
import { clearDebugCircles, updateDebugCircles } from "../util/pathingDebug.ts";

const advanceWalk = (e: Entity, delta: number) => {
  if (
    e.action?.type !== "walk" || !e.position || !e.movementSpeed ||
    e.action.path.length === 0
  ) return;

  let target = typeof e.action.target === "string"
    ? lookup[e.action.target]?.position
    : e.action.target;

  if (!target) return;

  target = e.action.path[0];

  let movement = e.movementSpeed * delta;

  // Tween along movement
  let remaining = distanceBetweenPoints(target, e.position);
  let p = movement / remaining;
  let last = e.position;
  while (p > 1) {
    if (e.action.path.length === 1) {
      e.position = { ...target };
      break;
    }

    movement -= remaining;
    [last, target] = e.action.path;
    e.action = { ...e.action, path: e.action.path.slice(1) };
    remaining = distanceBetweenPoints(target, last);
    p = movement / remaining;
  }

  e.position = p < 1
    ? {
      x: e.position.x * (1 - p) + target.x * p,
      y: e.position.y * (1 - p) + target.y * p,
    }
    : {
      x: target.x,
      y: target.y,
    };
};

app.addSystem({
  props: ["action"],
  updateEntity: (e, delta) => {
    // Turn; consume delta if target point is outside angle of attack (±60°)
    const lookTarget = e.action.type === "attack"
      ? lookup[e.action.target]?.position
      : e.action.type === "build"
      ? e.action
      : e.action.type === "walk"
      ? e.action.path[0]
      : undefined;
    if (lookTarget && e.turnSpeed && e.position) {
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

    updateDebugCircles(e);

    switch (e.action.type) {
      case "walk":
        advanceWalk(e, delta);
        break;
      case "attack":
      case "build":
      case "hold":
      case "cast":
        break;
      default:
        absurd(e.action);
    }
  },
  onRemove: clearDebugCircles,
});
