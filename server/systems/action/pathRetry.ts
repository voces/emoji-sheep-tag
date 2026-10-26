import { Entity } from "@/shared/types.ts";
import { isMoving } from "@/shared/pathing/util.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { calcPath } from "../pathing.ts";
import { getTick } from "../../api/timing.ts";
import { TICK_RATE } from "@/shared/constants.ts";

type CalcPathTarget = Parameters<typeof calcPath>[1];
type CalcPathOptions = Parameters<typeof calcPath>[2];

const REPATH_INTERVAL = 0.5; // seconds

/** Ticks a unit holds behind a moving blocker before routing around it. */
const MIN_BLOCKED_TICKS = 6;
const BLOCKED_TICK_JITTER = 8;

const blockedFor = new WeakMap<Entity, { tick: number; count: number }>();

/** Deterministic per-entity hash, used to stagger retries across a crowd. */
const hashId = (id: string) =>
  Math.abs(
    id.split("").reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0),
  );

/** Whether the entity held its plan on this tick or the one before it. */
export const isWaitingOnBlocker = (entity: Entity): boolean => {
  const previous = blockedFor.get(entity);
  return !!previous && previous.tick >= getTick() - 1;
};

/**
 * Whether the entity should hold its plan rather than route around what is
 * blocking it.
 *
 * A blocker that is itself waiting is not going to clear, so it does not earn a
 * wait — otherwise two units facing each other both hold and visibly freeze.
 * The tick count is a backstop for the rest, staggered per entity so units give
 * up at different ticks.
 */
export const shouldWaitForBlockers = (
  entity: Entity,
  blockers: Entity[],
): boolean => {
  // Only an ally earns a wait. One is passing through and will clear, so
  // holding keeps a queue flowing through a gap instead of every follower
  // computing a private detour. An enemy in the way is not being polite — it is
  // blocking on purpose, and standing still for it hands it the block and reads
  // as stuttering rather than moving around it.
  if (
    !blockers.some((b) =>
      isMoving(b) && !isWaitingOnBlocker(b) && isAlly(entity, b)
    )
  ) return false;

  const tick = getTick();
  const previous = blockedFor.get(entity);
  const count = !previous || previous.tick < tick - 1
    ? 1
    : previous.tick === tick
    ? previous.count
    : previous.count + 1;
  blockedFor.set(entity, { tick, count });

  // Held units write nothing else, so say that it is holding. A client that
  // knows stops predicting it forward instead of walking on and being snapped
  // back when it eventually moves. Cleared the moment it advances again.
  if (!entity.blocked) entity.blocked = true;

  return count <=
    MIN_BLOCKED_TICKS + hashId(entity.id) % BLOCKED_TICK_JITTER;
};

/**
 * Determines if enough time has passed to repath
 * Uses entity ID hash for deterministic staggering
 */
export const shouldRepath = (entity: Entity, currentTime: number): boolean => {
  if (!entity.order || !("lastRepath" in entity.order)) return true;
  if (!entity.order.lastRepath) return true;

  // Hash entity ID to get a deterministic offset (0-500ms)
  const offset = hashId(entity.id) % 500 / 1000;

  return (currentTime - entity.order.lastRepath) >= (REPATH_INTERVAL + offset);
};

/** How long a unit keeps an order whose plan the blocker leaves unchanged. */
const GIVE_UP_TICKS = Math.round(2 / TICK_RATE);

/** First and latest tick of the entity's current run of failed re-plans. */
const stuckSince = new WeakMap<Entity, { since: number; last: number }>();

const samePath = (
  a: readonly { x: number; y: number }[],
  b: readonly { x: number; y: number }[],
) =>
  a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);

/**
 * Re-plans a blocked entity's path. "rerouted" means the order now holds a new
 * path. "wait" means no better plan exists yet: keep the order and stay put
 * this tick. A blocker on its way off often already reads as clear to the
 * planner, which works in quarter tiles, so the plan comes back unchanged while
 * the walker still collides; giving up then would drop orders a moment before
 * they could proceed. "cancel" once that has lasted GIVE_UP_TICKS.
 */
export const handleBlockedPath = (
  entity: Entity,
  target: CalcPathTarget,
  currentPath: readonly { x: number; y: number }[],
  options?: CalcPathOptions,
): "rerouted" | "wait" | "cancel" => {
  const retryPath = calcPath(entity, target, options);
  const path = retryPath.length && !samePath(retryPath, currentPath)
    ? retryPath
    : calcPath(entity, target, {
      ...options,
      lead: false,
      removeMovingEntities: false,
    });

  if (path.length && !samePath(path, currentPath)) {
    stuckSince.delete(entity);
    if (entity.order && "path" in entity.order) {
      entity.order = { ...entity.order, path };
    }
    return "rerouted";
  }

  const tick = getTick();
  const previous = stuckSince.get(entity);
  const since = previous && previous.last >= tick - 1 ? previous.since : tick;
  if (tick - since >= GIVE_UP_TICKS) {
    stuckSince.delete(entity);
    return "cancel";
  }
  stuckSince.set(entity, { since, last: tick });
  return "wait";
};
