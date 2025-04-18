import { angleDifference, tweenAbsAngles } from "../../shared/pathing/math.ts";
import { app } from "../ecs.ts";
import { lookup } from "./lookup.ts";

// TODO: this should be done on the backend and shouldn't be able to swing backwards
app.addSystem({
  props: ["isAttacking"],
  updateChild: (e, delta) => {
    if (
      !e.turnSpeed || (!e.swing && e.action?.type !== "attack") || !e.position
    ) return;
    const target = e.swing?.target ??
      lookup[e.action?.type === "attack" ? e.action.target : ""]?.position;
    if (!target) return;
    const targetAngle = Math.atan2(
      target.y - e.position.y,
      target.x - e.position.x,
    );

    const facing = e.facing ?? Math.PI * 3 / 2;

    const diff = Math.abs(angleDifference(facing, targetAngle));
    const maxTurn = e.turnSpeed * delta;
    e.facing = diff < maxTurn
      ? targetAngle
      : tweenAbsAngles(facing, targetAngle, maxTurn);
  },
});
