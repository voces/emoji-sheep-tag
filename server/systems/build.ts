import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { build, computeBuildDistance, orderBuild } from "../api/unit.ts";
import { onInit } from "../ecs.ts";

export const advanceBuild = (e: Entity, delta: number): number => {
  if (e.action?.type !== "build") return delta;
  if (!e.position) {
    delete e.action;
    return delta;
  }

  const d = computeBuildDistance(e.action.unitType);

  // No longer in range; get in range
  if (distanceBetweenPoints(e.position, e.action) > d) {
    // delete e.action;
    const { unitType, x, y } = e.action;
    delete e.action;
    orderBuild(e, unitType, x, y);
    console.log("too far!", d, distanceBetweenPoints(e.position, { x, y }));
    return delta;
  }

  // Face build target
  if (e.turnSpeed) {
    const facing = e.facing ?? DEFAULT_FACING;
    const targetAngle = Math.atan2(
      e.action.y - e.position.y,
      e.action.x - e.position.x,
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

  if (delta === 0) return delta;

  build(e, e.action.unitType, e.action.x, e.action.y);
  e.action = null;
  return delta;
};

onInit((game) =>
  game.addSystem({
    props: ["progress", "completionTime"],
    updateEntity: (e, delta) => {
      if (e.progress + delta >= 1) {
        return delete (e as Entity).progress;
      }
      e.progress += delta / e.completionTime;
    },
  })
);
