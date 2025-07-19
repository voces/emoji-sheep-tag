import { advanceAttack } from "./attack.ts";
import { advanceBuild } from "./build.ts";
import { absurd } from "../../shared/util/absurd.ts";
import { onInit } from "../ecs.ts";
import { advanceMovement } from "./movement.ts";
import { lookup } from "./lookup.ts";
import { DEFAULT_FACING, MAX_ATTACK_ANGLE } from "../../shared/constants.ts";
import { angleDifference, tweenAbsAngles } from "../../shared/pathing/math.ts";
import { advanceCast } from "./cast.ts";
import { orderAttack } from "../api/unit.ts";

onInit((app) => {
  app.addSystem({
    props: ["action"],
    onChange: (e) => {
      if (e.action.type !== "attack" && e.swing) delete e.swing;
    },
    updateEntity: (e, delta) => {
      let attackCooldownAvailable = delta;

      let loops = 1000;
      while ((e.action || e.queue?.length) && delta > 0) {
        if (!loops--) {
          console.warn("Over 1000 action loops!", e.id, e.action);
          break;
        }

        // Advance queue
        if (!e.action) {
          if (e.queue && e.queue.length > 0) {
            if (e.queue.length > 1) [e.action, ...e.queue] = e.queue;
            else {
              e.action = e.queue[0];
              delete e.queue;
            }
          } else break;
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
        const lookTarget = e.action.type === "attack"
          ? lookup(e.action.target)?.position
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

        // Abort swing delta consumed turning
        if (delta === 0) break;

        switch (e.action.type) {
          // TODO: consolidate turning
          case "attack":
            delta = advanceAttack(e, delta);
            break;
          case "build":
            delta = advanceBuild(e, delta);
            break;
          case "walk":
            delta = advanceMovement(e, delta);
            break;
          case "hold":
            delta = 0;
            break;
          case "cast":
            delta = advanceCast(e, delta);
            break;
          case "attackMove":
            orderAttack(e, e.action.target);
            break;
          default:
            absurd(e.action);
        }
      }
    },
  });
});
