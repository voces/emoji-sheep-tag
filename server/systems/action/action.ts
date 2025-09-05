import { advanceBuild } from "./advanceBuild.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { lookup } from "../lookup.ts";
import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "@/shared/constants.ts";
import { angleDifference, tweenAbsAngles } from "@/shared/pathing/math.ts";
import { advanceCast } from "./advanceCast.ts";
import { advanceWalk } from "./advanceWalk.ts";
import { advanceAttack } from "./advanceAttack.ts";
import { advanceAttackMove } from "./advanceAttackMove.ts";
import { addSystem } from "@/shared/context.ts";

addSystem({
  props: ["order"],
  onChange: (e) => {
    if (
      e.order.type !== "attack" && e.order.type !== "attackMove" && e.swing
    ) delete e.swing;
  },
  updateEntity: (e, delta) => {
    let attackCooldownAvailable = delta;

    let loops = 10;
    while (e.order && delta > 0) {
      if (!loops--) {
        console.warn("Over 10 order loops!", e.id, e.order);
        break;
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

      // Turn; consume delta if target point is outside angle of attack (±60°)
      const lookTarget = "path" in e.order && e.order.path?.[0] ||
        "targetId" in e.order && e.order.targetId &&
          lookup(e.order.targetId)?.position ||
        "target" in e.order && e.order.target ||
        ("x" in e.order && "y" in e.order && { x: e.order.x, y: e.order.y }) ||
        undefined;
      if (
        lookTarget && e.turnSpeed && e.position &&
        (lookTarget.x !== e.position.x || lookTarget.y !== e.position.y)
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

          // Abort swing delta consumed turning
          if (delta === 0) break;
        }
      }

      switch (e.order.type) {
        case "attack":
          delta = advanceAttack(e, delta);
          break;
        case "build":
          delta = advanceBuild(e, delta);
          break;
        case "walk":
          delta = advanceWalk(e, delta);
          break;
        case "hold":
          delta = 0;
          break;
        case "cast":
          delta = advanceCast(e, delta);
          break;
        case "attackMove":
          delta = advanceAttackMove(e, delta);
          break;
        default:
          absurd(e.order);
      }
    }
  },
});
