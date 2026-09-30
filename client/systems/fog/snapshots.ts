import { app, Entity, map } from "../../ecs.ts";

// Cache last-seen state for structures in fog
type FogSnapshot = {
  model: string | undefined;
  progress: number | null | undefined;
};
const fogSnapshots = new WeakMap<Entity, FogSnapshot>();

// Store pending server values that were blocked while entity was in fog
type PendingServerValues = {
  model?: string | null;
  prefab?: string | null;
  progress?: number | null;
};
const pendingServerValues = new WeakMap<Entity, PendingServerValues>();

// Track entities that should be removed when revealed (server deleted them while in fog)
// Using Set instead of WeakSet to allow iteration for sheep death cleanup
const pendingRemoval = new Set<Entity>();

/** Mark an entity for removal when it becomes visible (structure destroyed in fog) */
export const markPendingRemoval = (entity: Entity) => {
  pendingRemoval.add(entity);
};

/** Check if an entity is pending removal */
export const isPendingRemoval = (entity: Entity): boolean =>
  pendingRemoval.has(entity);

/** Remove an entity from pending removal and clean up its fog state */
const removePendingEntity = (entity: Entity) => {
  pendingRemoval.delete(entity);
  fogSnapshots.delete(entity);
  pendingServerValues.delete(entity);
  app.removeEntity(entity);
  delete map[entity.id];
};

/** Remove all pending entities matching a filter predicate */
export const removePendingEntitiesWhere = (
  predicate: (entity: Entity) => boolean,
) => {
  for (const entity of pendingRemoval) {
    if (predicate(entity)) removePendingEntity(entity);
  }
};

/** Remove a revealed entity if the server deleted it while it was in fog */
export const removeIfPendingRemoval = (entity: Entity): boolean => {
  if (!pendingRemoval.has(entity)) return false;
  pendingRemoval.delete(entity);
  app.removeEntity(entity);
  delete map[entity.id];
  return true;
};

const snapshotEntity = (entity: Entity): FogSnapshot => ({
  model: entity.model ?? entity.prefab,
  progress: entity.progress,
});

/** Get snapshotted values for an entity if it has a fog snapshot */
export const getFogSnapshot = (entity: Entity): FogSnapshot | undefined =>
  fogSnapshots.get(entity);

/** Snapshot an entity's current values as it enters fog, if not already */
export const ensureFogSnapshot = (entity: Entity) => {
  if (!fogSnapshots.has(entity)) {
    fogSnapshots.set(entity, snapshotEntity(entity));
  }
};

export const clearFogSnapshot = (entity: Entity) => {
  fogSnapshots.delete(entity);
};

/** Store pending server values that were blocked while entity is in fog */
export const storePendingServerValues = (
  entity: Entity,
  values: PendingServerValues,
) => {
  const existing = pendingServerValues.get(entity) ?? {};
  // Only merge values that are not undefined (undefined means "not in this patch")
  const merged = { ...existing };
  if (values.model !== undefined) merged.model = values.model;
  if (values.prefab !== undefined) merged.prefab = values.prefab;
  if (values.progress !== undefined) merged.progress = values.progress;
  pendingServerValues.set(entity, merged);
};

/** Apply pending server values when entity becomes visible, then clear them */
export const applyPendingServerValues = (entity: Entity) => {
  const pending = pendingServerValues.get(entity);
  if (pending) {
    if (pending.model !== undefined) entity.model = pending.model ?? undefined;
    if (pending.prefab !== undefined) {
      entity.prefab = pending.prefab ?? undefined;
    }
    if (pending.progress !== undefined) entity.progress = pending.progress;
    pendingServerValues.delete(entity);
  }
};
