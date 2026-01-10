import { Entity } from "@/shared/types.ts";
import { acquireTarget, isAlive, prioritizeTarget } from "../../api/unit.ts";
import { canSee } from "@/shared/api/unit.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenAttack } from "./tweenAttack.ts";
import { tweenPath } from "./tweenPath.ts";
import { handleBlockedPath } from "./pathRetry.ts";

export const advanceAttackMove = (e: Entity, delta: number): number => {
  if (e.order?.type !== "attackMove") return delta;

  // Clear target if dead or not visible
  if (e.order.targetId) {
    const target = lookup(e.order.targetId);
    if (!target || !isAlive(target) || !canSee(e, target)) {
      const { targetId: _, ...rest } = e.order;
      e.order = rest;
    }
  }

  // Acquire a target if don't have one
  if (!e.order.targetId) {
    const next = acquireTarget(e);
    if (next) e.order = { ...e.order, targetId: next.id };
  } else {
    const target = lookup(e.order.targetId);
    // Check if there's a higher priority target available
    const acquired = acquireTarget(e);
    if (
      target && acquired &&
      prioritizeTarget(acquired) > prioritizeTarget(target)
    ) {
      const { path: _, ...rest } = e.order;
      e.order = { ...rest, targetId: acquired.id };
    }
  }

  // Attack target if have one
  if (e.order.targetId) return tweenAttack(e, delta);

  // Otherwise proceed along path
  if (!e.order.path) {
    const path = calcPath(e, e.order.target);
    if (!path.length) {
      delete e.order;
      return delta;
    }
    e.order = { ...e.order, path };
  }

  const tweenResult = tweenPath(e, delta);

  if (tweenResult.pathBlocked && e.order.path) {
    if (handleBlockedPath(e, e.order.target, e.order.path)) {
      delete e.order;
      return delta;
    }
    return delta;
  }

  if (
    (e.order.path?.at(-1)?.x === e.position?.x &&
      e.order.path?.at(-1)?.y === e.position?.y)
  ) {
    if (
      e.position?.x === e.order.target.x && e.position.y === e.order.target.y
    ) delete e.order;
    else {
      const { path: _, ...rest } = e.order;
      e.order = rest;
    }
  }

  return tweenResult.delta;
};
