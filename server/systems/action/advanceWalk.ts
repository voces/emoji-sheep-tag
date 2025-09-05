import { lookup } from "../lookup.ts";
import { FOLLOW_DISTANCE } from "@/shared/constants.ts";
import { isAlive } from "../../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";

const updatePath = (
  e: Entity,
  delta: number,
  removeMovingEntities = false,
): number | undefined => {
  if (e.order?.type !== "walk") return delta;
  if ("targetId" in e.order) {
    const target = lookup(e.order.targetId);
    if (!target || !isAlive(target)) {
      delete e.order;
      return delta;
    }
    const path = calcPath(e, e.order.targetId, {
      distanceFromTarget: FOLLOW_DISTANCE,
      removeMovingEntities,
    });
    // TODO: Ignore very short paths!
    if (!path.length) return 0;
    e.order = { ...e.order, path };
  } else {
    e.order = {
      ...e.order,
      path: calcPath(e, e.order.target, { removeMovingEntities }),
    };
  }
};

export const advanceWalk = (e: Entity, delta: number): number => {
  if (e.order?.type !== "walk") return delta;

  // TODO: Shouldn't recompute EVERY time since it's expensive, but eh
  const result = updatePath(e, delta);
  if (typeof result === "number") return result;

  if (!e.order.path) {
    delete e.order;
    return delta;
  }

  let newDelta = tweenPath(e, delta);
  if (newDelta === delta) {
    const result = updatePath(e, delta, true);
    if (typeof result === "number") return result;

    newDelta = tweenPath(e, delta);
    if (newDelta === delta) {
      delete e.order;
      return delta;
    }
  }

  // Reached end
  if (
    (!e.order.path.length ||
      (e.order.path.at(-1)?.x === e.position?.x &&
        e.order.path.at(-1)?.y === e.position?.y)) && "target" in e.order
  ) delete e.order;

  return newDelta;
};
