import {
  angleDifference,
  distanceBetweenPoints,
  squaredDistanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";

// Movement system
app.addSystem({
  props: ["isMoving", "position"],
  updateChild: (e, delta) => {
    // If not moving or can't move, clear it
    if (
      !e.movementSpeed || e.action?.type !== "walk"
      // (e.action.target.x === e.position?.x) &&
      //   e.movement[e.movement.length - 1].y === e.position.y
    ) return delete (e as Entity).isMoving;

    let target = typeof e.action.target === "string"
      ? lookup[e.action.target]?.position
      : e.action.target;
    const distanceFromTargetSquared = (e.action.distanceFromTarget ?? 0) ** 2;

    if (
      !target ||
      squaredDistanceBetweenPoints(target, e.position) <=
        distanceFromTargetSquared
    ) {
      delete (e as Entity).isMoving;
      delete e.action;
      return;
    }

    target = e.action.path[0];

    if (e.turnSpeed) {
      let facing = e.facing ?? Math.PI * 3 / 2;
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
      if (diff > Math.PI / 3) {
        delta = Math.max(0, delta - (diff - Math.PI / 3) / e.turnSpeed);
      }
    }

    if (delta === 0) return;

    let movement = e.movementSpeed * delta;

    // Tween along movement
    let remaining = distanceBetweenPoints(target, e.position);
    let p = movement / remaining;
    let last = e.position;
    while (p > 1) {
      if (e.action.path.length === 1) {
        e.position = { ...target };
        delete (e as Entity).isMoving;
        delete e.action;
        break;
      }

      movement -= remaining;
      target = e.action.path[1];
      e.action = { ...e.action, path: e.action.path.slice(1) };
      remaining = distanceBetweenPoints(target, last);
      p = movement / remaining;
      last = target;
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
  },
});
