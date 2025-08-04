import { lookup } from "../lookup.ts";
import { FOLLOW_DISTANCE } from "../../../shared/constants.ts";
import { isAlive } from "../../api/unit.ts";
import { Entity } from "../../../shared/types.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";

export const advanceWalk = (e: Entity, delta: number): number => {
  if (e.order?.type !== "walk") return delta;

  if ("targetId" in e.order) {
    const target = lookup(e.order.targetId);
    if (!target || !isAlive(target)) {
      delete e.order;
      return delta;
    }
    // TODO: this can crash loop!
    const path = calcPath(e, e.order.targetId, {
      distanceFromTarget: FOLLOW_DISTANCE,
    });
    if (!path.length) return 0;
    e.order = { ...e.order, path };
  } else {
    e.order = { ...e.order, path: calcPath(e, e.order.target) };
  }

  if (!e.order.path) {
    delete e.order;
    return delta;
  }

  delta = tweenPath(e, delta);

  // Reached end
  if (
    (!e.order.path.length ||
      (e.order.path.at(-1)?.x === e.position?.x &&
        e.order.path.at(-1)?.y === e.position?.y)) && "target" in e.order
  ) delete e.order;

  return delta;
};
