import { distanceBetweenPoints } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { build, computeBuildDistance, orderBuild } from "../api/unit.ts";
import { onInit } from "../ecs.ts";

export const advanceBuild = (e: Entity, delta: number): number => {
  if (e.action?.type !== "build") return delta;
  if (!e.position) {
    delete e.action;
    return delta;
  }

  const d = computeBuildDistance(e.action.unitType);

  // No longer in range; get in range
  if (distanceBetweenPoints(e.position, e.action) > d) {
    // delete e.action;
    const { unitType, x, y } = e.action;
    delete e.action;
    orderBuild(e, unitType, x, y);
    return delta;
  }

  if (delta === 0) return delta;

  build(e, e.action.unitType, e.action.x, e.action.y);
  e.action = null;
  return delta;
};

onInit((game) =>
  game.addSystem({
    props: ["progress", "completionTime"],
    updateEntity: (e, delta) => {
      if (e.progress + delta >= 1) {
        return delete (e as Entity).progress;
      }
      e.progress += delta / e.completionTime;
    },
  })
);
