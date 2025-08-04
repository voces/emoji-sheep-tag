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
    e.order = {
      ...e.order,
      path: calcPath(e, e.order.targetId, {
        distanceFromTarget: FOLLOW_DISTANCE + (target.radius ?? 0),
      }).slice(1),
    };
  } else {
    e.order = { ...e.order, path: calcPath(e, e.order.target).slice(1) };
  }

  if (!e.order.path) {
    delete e.order;
    return delta;
  }

  delta = tweenPath(e, delta);

  if (
    (e.order.path.at(-1)?.x === e.position?.x &&
      e.order.path.at(-1)?.y === e.position?.y) && "target" in e.order
  ) delete e.order;

  return delta;
};
