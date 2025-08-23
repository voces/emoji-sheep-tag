import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { build, computeBuildDistance } from "../../api/unit.ts";
import { addSystem } from "../../ecs.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";

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
      e.order = {
        ...e.order,
        path: calcPath(e, e.order, { distanceFromTarget: d }),
      };
      if (!e.order.path?.length) {
        delete e.order;
        return delta;
      }
    }

    const newDelta = tweenPath(e, delta);

    if (delta === newDelta) {
      const newPath = calcPath(e, e.order, { distanceFromTarget: d });
      if (
        !newPath.length ||
        (newPath.length === e.order.path.length &&
          newPath.every((p, i) =>
            e.order && "path" in e.order && e.order.path?.[i] === p
          ))
      ) {
        delete e.order;
        return delta;
      } else e.order = { ...e.order, path: newPath };
    }

    return newDelta;
  }

  build(e, e.order.unitType, e.order.x, e.order.y);
  delete e.order;
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
