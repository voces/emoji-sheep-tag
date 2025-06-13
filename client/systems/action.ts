import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { absurd } from "../../shared/util/absurd.ts";
import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";

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

  if (e.turnSpeed) {
    const facing = e.facing ?? DEFAULT_FACING;
    const targetAngle = Math.atan2(
      target.y - e.position.y,
      target.x - e.position.x,
    );
    const diff = Math.abs(angleDifference(facing, targetAngle));
    if (diff > 1e-07) {
      const maxTurn = e.turnSpeed * delta;
      e.facing = tweenAbsAngles(facing, targetAngle, maxTurn);
    }
    if (diff > MAX_ATTACK_ANGLE) {
      delta = Math.max(0, delta - (diff - MAX_ATTACK_ANGLE) / e.turnSpeed);
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
};

const advanceAttack = (e: Entity, delta: number) => {
  if (e.action?.type !== "attack") return;

  if (
    !e.turnSpeed || (!e.swing && e.action?.type !== "attack") || !e.position
  ) return;

  const target = lookup[e.action?.type === "attack" ? e.action.target : ""]
    ?.position;
  if (!target) return;

  const facing = e.facing ?? DEFAULT_FACING;
  const targetAngle = Math.atan2(
    target.y - e.position.y,
    target.x - e.position.x,
  );
  const diff = Math.abs(angleDifference(facing, targetAngle));
  if (diff > 1e-07) {
    const maxTurn = e.turnSpeed * delta;
    e.facing = tweenAbsAngles(facing, targetAngle, maxTurn);
  }

  return;
};

app.addSystem({
  props: ["action"],
  updateEntity: (e, delta) => {
    switch (e.action.type) {
      case "walk":
        advanceWalk(e, delta);
        break;
      case "attack":
        advanceAttack(e, delta);
        break;
      case "build":
      case "hold":
        break;
      default:
        absurd(e.action);
    }
  },
});
