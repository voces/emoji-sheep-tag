import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { build, computeBuildDistance } from "../../api/unit.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { addSystem } from "@/shared/context.ts";
import { handleBlockedPath } from "./pathRetry.ts";

export const advanceBuild = (e: Entity, delta: number): number => {
  if (e.order?.type !== "build") return delta;
  if (!e.position) {
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
    if (e.progress + delta >= 1) return delete (e as Entity).progress;
    e.progress += delta / e.completionTime;
  },
});
