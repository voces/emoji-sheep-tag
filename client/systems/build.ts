import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import { angleDifference, tweenAbsAngles } from "../../shared/pathing/math.ts";
import { app } from "../ecs.ts";

app.addSystem({
  props: ["isBuilding", "position"],
  updateEntity: (e, delta) => {
    if (e.action?.type !== "build") return;

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
  },
});
