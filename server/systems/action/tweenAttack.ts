import { distanceBetweenEntities } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { tweenSwing } from "./tweenSwing.ts";
import { handleBlockedPath } from "./pathRetry.ts";
import { breakInvisibility } from "../../api/unit.ts";
import { getTick } from "../../api/timing.ts";

const REPATH_TICKS = 10;
const REPATH_DIST_SQ = 2.25; // 1.5^2

type RepathState = { x: number; y: number; tick: number; appended: boolean };
const repathState = new WeakMap<Entity, RepathState>();

const fullRepath = (
  e: Entity,
  targetId: string,
  targetPos: { x: number; y: number },
) => {
  repathState.set(e, {
    x: targetPos.x,
    y: targetPos.y,
    tick: getTick(),
    appended: false,
  });
  return calcPath(e, targetId);
};

export const tweenAttack = (e: Entity, delta: number) => {
  if (
    !e.position || !e.attack || !e.order ||
    (e.order.type !== "attack" && e.order.type !== "attackMove")
  ) return delta;

  // Ground attack (only for attack orders with target but no targetId)
  if (
    e.order.type === "attack" && "target" in e.order && e.order.target &&
    !("targetId" in e.order)
  ) {
    if (e.swing) return tweenSwing(e, delta);

    if (!e.attackCooldownRemaining) {
      breakInvisibility(e);
      e.swing = {
        remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
        source: e.position,
        target: e.order.target,
      };
      return delta;
    }

    return 0;
  }

  // Entity attack (for both attack and attackMove orders with targetId)
  if (!("targetId" in e.order)) return delta;

  const target = lookup(e.order.targetId);
  if (!target?.position) {
    delete e.swing;
    return delta;
  }

  if (e.swing) return tweenSwing(e, delta);

  // Target too far, need to move closer
  if (distanceBetweenEntities(e, target, e.attack.range) > e.attack.range) {
    const hasPath = ("path" in e.order) && e.order.path &&
      e.order.path.length > 0;

    // First, try to follow existing path if we have one
    if (hasPath) {
      const tweenResult = tweenPath(e, delta);

      if (tweenResult.pathBlocked) {
        // If close enough that the target itself is likely blocking,
        // skip expensive repath and proceed to attack
        if (
          distanceBetweenEntities(e, target, e.attack.range) <= e.attack.range
        ) {
          console.log("swing!");
          repathState.delete(e);
          const { path: _path, lastRepath: _lastRepath, ...rest } = e.order;
          e.order = rest;
          if (!e.attackCooldownRemaining) {
            breakInvisibility(e);
            e.swing = {
              remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
              source: e.position,
              target: target.position,
            };
            return delta;
          }
          return 0;
        } else {
          // Path blocked by something else, try to regenerate
          const currentPath = "path" in e.order ? e.order.path : undefined;
          if (currentPath) {
            const shouldCancel = handleBlockedPath(e, target.id, currentPath);
            if (shouldCancel) {
              repathState.delete(e);
              delete e.order;
              return delta;
            }
            // handleBlockedPath computed a new real path
            repathState.set(e, {
              x: target.position.x,
              y: target.position.y,
              tick: getTick(),
              appended: false,
            });
            // Path was updated - try new path immediately
            const retryResult = tweenPath(e, delta);
            if (retryResult.pathBlocked) {
              // Still blocked after retry, give up for this frame
              return 0;
            }
            return retryResult.delta;
          }
          // No path to handle, can't make progress
          return 0;
        }
      }

      // Check if we should recalculate path to account for moving target
      const reachedPathEnd = e.order.path?.length === 1 &&
        e.order.path[0].x === e.position?.x &&
        e.order.path[0].y === e.position?.y;

      if (tweenResult.delta < delta || reachedPathEnd) {
        const state = repathState.get(e);
        const targetMovedSq = state
          ? (target.position.x - state.x) ** 2 +
            (target.position.y - state.y) ** 2
          : Infinity;
        const ticksSinceRepath = getTick() - (state?.tick ?? 0);

        const shouldFullRepath = reachedPathEnd ||
          targetMovedSq > REPATH_DIST_SQ ||
          ticksSinceRepath >= REPATH_TICKS;

        if (shouldFullRepath) {
          const newPath = fullRepath(e, target.id, target.position);
          if (newPath.length) {
            e.order = { ...e.order, path: newPath };
          } else if (
            distanceBetweenEntities(e, target, e.attack.range) > e.attack.range
          ) {
            repathState.delete(e);
            delete e.order;
            return delta;
          } else {
            repathState.delete(e);
            const { path: _path, lastRepath: _lastRepath, ...rest } = e.order;
            e.order = rest;
          }
        } else if (e.order.path && e.order.path.length > 0) {
          // Cheap tracking: append/update target position at end of path
          const lastWp = e.order.path[e.order.path.length - 1];
          if (
            lastWp.x !== target.position.x ||
            lastWp.y !== target.position.y
          ) {
            const currentPath = e.order.path;
            const basePath = state?.appended && currentPath.length > 1
              ? currentPath.slice(0, -1)
              : currentPath;
            repathState.set(e, {
              x: state?.x ?? target.position.x,
              y: state?.y ?? target.position.y,
              tick: state?.tick ?? getTick(),
              appended: true,
            });
            e.order = {
              ...e.order,
              path: [...basePath, { ...target.position }],
            };
          }
        }
      }

      return tweenResult.delta;
    }

    // No path yet or need to regenerate - always calculate
    const newPath = fullRepath(e, target.id, target.position);
    if (!newPath.length) {
      if (distanceBetweenEntities(e, target, e.attack.range) > e.attack.range) {
        repathState.delete(e);
        delete e.order;
        return delta;
      }
      // Within attack range but can't path closer - proceed without path
      return delta;
    }
    e.order = { ...e.order, path: newPath };

    // Try to make progress immediately
    return tweenPath(e, delta).delta;
  } else if ("path" in e.order && e.order.path) {
    repathState.delete(e);
    const { path: _path, lastRepath: _lastRepath, ...rest } = e.order;
    e.order = rest;
  }

  if (!e.attackCooldownRemaining) {
    breakInvisibility(e);
    e.swing = {
      remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
      source: e.position,
      target: target.position,
    };
    return delta;
  }

  return 0;
};
