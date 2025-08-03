import { Entity } from "../../../shared/types.ts";
import { acquireTarget, isAlive } from "../../api/unit.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenAttack } from "./tweenAttack.ts";
import { tweenPath } from "./tweenPath.ts";

export const advanceAttackMove = (e: Entity, delta: number): number => {
  if (e.order?.type !== "attackMove") return delta;

  // Clear target if dead
  if (e.order.targetId) {
    const target = lookup(e.order.targetId);
    if (!target || !isAlive(target)) {
      const { targetId: _, ...rest } = e.order;
      e.order = rest;
    }
  }

  // Acquire a target if don't have one
  if (!e.order.targetId) {
    const next = acquireTarget(e);
    if (next) e.order = { ...e.order, targetId: next.id };
  }

  // Attack target if have one
  if (e.order.targetId) return tweenAttack(e, delta);

  // Otherwise proceed along path
  const path = calcPath(e, e.order.target).slice(1);
  if (!path.length) {
    delete e.order;
    return delta;
  }
  e.order = { ...e.order, path };

  delta = tweenPath(e, delta);

  if (
    (e.order.path?.at(-1)?.x === e.position?.x &&
      e.order.path?.at(-1)?.y === e.position?.y)
  ) delete e.order;

  return delta;
};
