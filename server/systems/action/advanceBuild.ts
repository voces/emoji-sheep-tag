import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { build, computeBuildDistance } from "../../api/unit.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { addSystem } from "@/shared/context.ts";
import { handleBlockedPath } from "./pathRetry.ts";

export const advanceBuild = (e: Entity, delta: number): number => {
  if (e.order?.type !== "build") return delta;
  if (!e.position || e.health === 0) {
    delete e.order;
    return delta;
  }

  const d = computeBuildDistance(e.order.unitType);

  // No longer in range; get in range
  if (distanceBetweenPoints(e.position, e.order) > d) {
    if (!e.order.path) {
      const path = calcPath(e, e.order, { distanceFromTarget: d });
      if (!path.length) {
        if (distanceBetweenPoints(e.position, e.order) > d) {
          // Target unreachable and out of build range
          delete e.order;
          return delta;
        }
        // Within build range but can't path closer - proceed without path
        return delta;
      }
      e.order = { ...e.order, path };
    }

    const tweenResult = tweenPath(e, delta);

    if (tweenResult.pathBlocked && e.order.path) {
      if (
        handleBlockedPath(e, e.order, e.order.path, { distanceFromTarget: d })
      ) {
        delete e.order;
        return delta;
      }
      return delta;
    }

    return tweenResult.delta;
  }

  build(e, e.order.unitType, e.order.x, e.order.y);
  delete e.order;
  return delta;
};

addSystem({
  props: ["progress", "completionTime"],
  updateEntity: (e, delta) => {
    const progressDelta = delta / e.completionTime;
    const isUpgrade = e.actions?.some((a) =>
      a.type === "auto" && a.order === "cancel-upgrade"
    );

    if (e.progress + progressDelta >= 1) {
      // Complete construction - add final health increment (capped at remaining progress)
      // Skip health increment for upgrades since they keep their existing health
      if (
        !isUpgrade &&
        typeof e.maxHealth === "number" &&
        typeof e.health === "number"
      ) {
        const remainingProgress = 1 - e.progress;
        e.health += e.maxHealth * remainingProgress;
      }
      delete (e as Entity).progress;
      if (isUpgrade) {
        e.actions = e.actions!.filter((a) =>
          a.type !== "auto" || a.order !== "cancel-upgrade"
        );
      }
      return;
    }

    // Increment health proportionally as progress increases
    // Skip for upgrades since they keep their existing health
    if (
      !isUpgrade &&
      typeof e.maxHealth === "number" &&
      typeof e.health === "number"
    ) {
      e.health += e.maxHealth * progressDelta;
    }
    e.progress += progressDelta;
  },
});
