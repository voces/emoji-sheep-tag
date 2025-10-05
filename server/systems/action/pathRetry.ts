import { Entity } from "@/shared/types.ts";
import { calcPath } from "../pathing.ts";

type CalcPathTarget = Parameters<typeof calcPath>[1];
type CalcPathOptions = Parameters<typeof calcPath>[2];

const REPATH_INTERVAL = 0.5; // seconds

/**
 * Determines if enough time has passed to repath
 * Uses entity ID hash for deterministic staggering
 */
export const shouldRepath = (entity: Entity, currentTime: number): boolean => {
  if (!entity.order || !("lastRepath" in entity.order)) return true;
  if (!entity.order.lastRepath) return true;

  // Hash entity ID to get a deterministic offset (0-500ms)
  const hashCode = entity.id.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const offset = Math.abs(hashCode % 500) / 1000;

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
    JSON.stringify(retryPath) === JSON.stringify(currentPath)
  ) {
    const finalPath = calcPath(entity, target, {
      ...options,
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
