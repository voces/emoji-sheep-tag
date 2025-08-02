import { Entity } from "../../../shared/types.ts";
import { acquireTarget, isAlive } from "../../api/unit.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenAttack } from "./tweenAttack.ts";
import { tweenPath } from "./tweenPath.ts";

export const advanceAttackMove = (e: Entity, delta: number): number => {
  if (e.action?.type !== "attackMove") return delta;

  // Clear target if dead
  if (e.action.targetId) {
    const target = lookup(e.action.targetId);
    if (!target || !isAlive(target)) {
      const { targetId: _, ...rest } = e.action;
      e.action = rest;
    }
  }

  // Acquire a target if don't have one
  if (!e.action.targetId) {
    const next = acquireTarget(e);
    if (next) e.action = { ...e.action, targetId: next.id };
  }

  // Attack target if have one
  if (e.action.targetId) return tweenAttack(e, delta);

  // Otherwise proceed along path
  const path = calcPath(e, e.action.target).slice(1);
  if (!path.length) {
    delete e.action;
    return delta;
  }
  e.action = { ...e.action, path };

  delta = tweenPath(e, delta);

  if (
    (e.action.path?.at(-1)?.x === e.position?.x &&
      e.action.path?.at(-1)?.y === e.position?.y)
  ) delete e.action;

  return delta;
};
