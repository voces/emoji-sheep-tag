import { lookup } from "../lookup.ts";
import { FOLLOW_DISTANCE } from "../../../shared/constants.ts";
import { isAlive } from "../../api/unit.ts";
import { Entity } from "../../../shared/types.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";

export const advanceWalk = (e: Entity, delta: number): number => {
  if (e.action?.type !== "walk") return delta;

  if ("targetId" in e.action) {
    const target = lookup(e.action.targetId);
    if (!target || !isAlive(target)) {
      delete e.action;
      return delta;
    }
    e.action = {
      ...e.action,
      path: calcPath(e, e.action.targetId, {
        distanceFromTarget: FOLLOW_DISTANCE + (target.radius ?? 0),
      }).slice(1),
    };
  } else {
    e.action = { ...e.action, path: calcPath(e, e.action.target).slice(1) };
  }

  if (!e.action.path) {
    delete e.action;
    return delta;
  }

  delta = tweenPath(e, delta);

  if (
    (e.action.path.at(-1)?.x === e.position?.x &&
      e.action.path.at(-1)?.y === e.position?.y) && "target" in e.action
  ) delete e.action;

  return delta;
};
