import { distanceBetweenPoints } from "../../../shared/pathing/math.ts";
import { Entity } from "../../../shared/types.ts";
import { build, computeBuildDistance } from "../../api/unit.ts";
import { addSystem } from "../../ecs.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";

export const advanceBuild = (e: Entity, delta: number): number => {
  if (e.action?.type !== "build") return delta;
  if (!e.position) {
    delete e.action;
    return delta;
  }

  const d = computeBuildDistance(e.action.unitType);

  // No longer in range; get in range
  if (distanceBetweenPoints(e.position, e.action) > d) {
    if (!e.action.path) {
      e.action = {
        ...e.action,
        path: calcPath(e, e.action, { distanceFromTarget: d }).slice(1),
      };
      if (!e.action.path?.length) {
        delete e.action;
        return delta;
      }
    }

    return tweenPath(e, delta);
  }

  build(e, e.action.unitType, e.action.x, e.action.y);
  delete e.action;
  return delta;
};

addSystem({
  props: ["progress", "completionTime"],
  updateEntity: (e, delta) => {
    if (e.progress + delta >= 1) {
      return delete (e as Entity).progress;
    }
    e.progress += delta / e.completionTime;
  },
});
