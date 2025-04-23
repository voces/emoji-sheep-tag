import { angleDifference, tweenAbsAngles } from "../../shared/pathing/math.ts";
import { app } from "../ecs.ts";

app.addSystem({
  props: ["isBuilding", "position"],
  updateEntity: (e, delta) => {
    if (e.action?.type !== "build") return;

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
  },
});
