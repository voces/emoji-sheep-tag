import {
  angleDifference,
  distanceBetweenPoints,
  tweenAbsAngles,
} from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { build, computeBuildDistance, orderBuild } from "../api/unit.ts";
import { onInit } from "../ecs.ts";

onInit((game) => {
  game.addSystem({
    props: ["isBuilding", "position"],
    updateChild: (e, delta) => {
      if (e.action?.type !== "build") return delete (e as Entity).isBuilding;
      const d = computeBuildDistance(e.action.unitType);

      // No longer in range; get in range
      if (distanceBetweenPoints(e.position, e.action) > d) {
        return orderBuild(e, e.action.type, e.action.x, e.action.y);
      }

      // Face build target
      if (e.turnSpeed) {
        let facing = e.facing ?? Math.PI * 3 / 2;
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
        // Must be facing ±60°
        if (diff > Math.PI / 3) {
          delta = Math.max(0, delta - (diff - Math.PI / 3) / e.turnSpeed);
        }
      }

      if (delta === 0) return;

      build(e, e.action.unitType, e.action.x, e.action.y);
      // Can either work?
      (e as Entity).action = null;
      delete (e as Entity).isBuilding;
    },
  });
});
