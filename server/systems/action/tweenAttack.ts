import { distanceBetweenEntities } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { tweenSwing } from "./tweenSwing.ts";
import { handleBlockedPath } from "./pathRetry.ts";

export const tweenAttack = (e: Entity, delta: number) => {
  if (
    !e.position || !e.attack || !e.order || !("targetId" in e.order) ||
    !e.order.targetId
  ) return delta;

  const target = lookup(e.order.targetId);
  if (!target?.position) return delta;

  if (e.swing) return tweenSwing(e, delta);

  // Target too far, need to move closer
  if (distanceBetweenEntities(e, target) > e.attack.range) {
    const now = Date.now() / 1000;

    // For attack orders (moving targets), recalculate path more frequently
    // Only recalculate if: no path, made progress, or path is stale
    const hasPath = ("path" in e.order) && e.order.path &&
      e.order.path.length > 0;

    // First, try to follow existing path if we have one
    if (hasPath) {
      const tweenResult = tweenPath(e, delta);

      if (tweenResult.pathBlocked) {
        // Path blocked, try to regenerate
        const currentPath = "path" in e.order ? e.order.path : undefined;
        if (currentPath) {
          const shouldCancel = handleBlockedPath(e, target.id, currentPath, {
            mode: "attack",
          });
          if (shouldCancel) {
            delete e.order;
            return delta;
          }
        }
        return delta;
      }

      // Recalculate path to account for moving target
      // Do this when: made progress OR reached end of path but still out of range
      const reachedPathEnd = e.order.path && e.order.path.length === 1 &&
        e.order.path[0].x === e.position?.x &&
        e.order.path[0].y === e.position?.y;

      if (tweenResult.delta < delta || reachedPathEnd) {
        const path = calcPath(e, target.id, { mode: "attack" });
        if (path.length) {
          e.order = { ...e.order, path, lastRepath: now };
        } else if (distanceBetweenEntities(e, target) > e.attack.range) {
          // Target became unreachable and out of attack range
          delete e.order;
          return delta;
        } else {
          // Can't path closer but within attack range - clear path and continue
          const { path: _path, lastRepath: _lastRepath, ...rest } = e.order;
          e.order = rest;
        }
      }

      return tweenResult.delta;
    }

    // No path yet or need to regenerate - always calculate
    const path = calcPath(e, target.id, { mode: "attack" });
    if (!path.length) {
      if (distanceBetweenEntities(e, target) > e.attack.range) {
        // Target unreachable and out of attack range
        delete e.order;
        return delta;
      }
      // Within attack range but can't path closer - proceed without path
      return delta;
    }
    e.order = { ...e.order, path, lastRepath: now };

    // Try to make progress immediately
    return tweenPath(e, delta).delta;
  } else if ("path" in e.order && e.order.path) {
    const { path: _path, lastRepath: _lastRepath, ...rest } = e.order;
    e.order = rest;
  }

  if (!e.attackCooldownRemaining) {
    e.swing = {
      remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
      source: e.position,
      target: target.position,
    };
    return delta;
  }

  return 0;
};
