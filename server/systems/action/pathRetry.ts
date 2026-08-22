import { Entity } from "@/shared/types.ts";
import { isMoving } from "@/shared/pathing/util.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { calcPath } from "../pathing.ts";
import { getTick } from "../../api/timing.ts";

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

/**
 * Attempts to handle a blocked path by regenerating it with various strategies
 * Returns true if order should be cancelled, false if path was updated
 */
export const handleBlockedPath = (
  entity: Entity,
  target: CalcPathTarget,
  currentPath: readonly { x: number; y: number }[],
  options?: CalcPathOptions,
): boolean => {
  // First retry: regenerate with default settings (removeMovingEntities=true)
  const retryPath = calcPath(entity, target, options);

  // If path is the same or empty, try without moving entities
  if (
    !retryPath.length ||
    (retryPath.length === currentPath.length &&
      retryPath.every((a, i) =>
        a.x === currentPath[i].x && a.y === currentPath[i].y
      ))
  ) {
    const finalPath = calcPath(entity, target, {
      ...options,
      lead: false,
      removeMovingEntities: false,
    });

    // If still no path or same path, give up
    if (
      !finalPath.length ||
      JSON.stringify(finalPath) === JSON.stringify(currentPath)
    ) {
      return true; // Cancel order
    }

    // Update with final path
    if (entity.order && "path" in entity.order) {
      entity.order = { ...entity.order, path: finalPath };
    }
    return false;
  }

  // Update with retry path
  if (entity.order && "path" in entity.order) {
    entity.order = { ...entity.order, path: retryPath };
  }
  return false;
};
