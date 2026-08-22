import { advanceBuild } from "./advanceBuild.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { lookup } from "../lookup.ts";
import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "@/shared/constants.ts";
import { angleDifference, tweenAbsAngles } from "@/shared/pathing/math.ts";
import { computeUnitMovementSpeed, turnSpeedCap } from "@/shared/api/unit.ts";
import { advanceCast } from "./advanceCast.ts";
import { advanceWalk } from "./advanceWalk.ts";
import { advanceAttack } from "./advanceAttack.ts";
import { advanceAttackMove } from "./advanceAttackMove.ts";
import { addSystem } from "@/shared/context.ts";
import { beginUpgrade } from "./beginUpgrade.ts";

addSystem({
  props: ["order"],
  onChange: (e) => {
    if (
      e.order.type !== "attack" && e.order.type !== "attackMove" && e.swing
    ) delete e.swing;
  },
  updateEntity: (e, delta) => {
    let attackCooldownAvailable = delta;

    // Turning is budgeted for the tick, not for each pass round the loop. A
    // unit that reroutes because something is in its way comes back round with
    // its delta intact, and without a budget it would turn afresh every pass —
    // spinning several times its own turn rate in a single tick.
    let turnBudget = delta;

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
        if (diff > 1e-07 && turnBudget > 0) {
          const maxTurn = e.turnSpeed * turnBudget;
          e.facing = tweenAbsAngles(facing, targetAngle, maxTurn);

          turnBudget -= Math.min(diff, maxTurn) / e.turnSpeed;
        }
        // How sharp the corner is caps how fast it may be taken, so a unit
        // comes out of one having to pick up speed again. A slight correction
        // costs next to nothing; swinging right around costs a step.
        if (e.speed) {
          e.speed = Math.min(
            e.speed,
            turnSpeedCap(computeUnitMovementSpeed(e), diff),
          );
        }

        if (diff > MAX_ATTACK_ANGLE) {
          delta = Math.max(
            0,
            delta - (diff - MAX_ATTACK_ANGLE) / e.turnSpeed,
          );

          // Abort if delta consumed turning
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
        case "upgrade":
          beginUpgrade(e);
          return;
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
