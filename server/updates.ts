import { Entity } from "@/shared/types.ts";
import { send } from "./lobbyApi.ts";

let updates: Record<string, Entity & { __delete?: boolean }> = {};

export const newEntity = (entity: Entity) => {
  updates[entity.id] = entity;
};

export const update = <K extends keyof Entity>(
  entityId: string,
  prop: K,
  value: Entity[K],
) => {
  if (!updates[entityId]) {
    updates[entityId] = { id: entityId, [prop]: value };
  } else updates[entityId][prop] = value;
};

export const remove = (entityId: string) => {
  if (!updates[entityId]) {
    updates[entityId] = { id: entityId, __delete: true };
  } else updates[entityId].__delete = true;
};

export const flushUpdates = () => {
  const updatesArray = Object.entries(updates);
  if (updatesArray.length) {
    send({ type: "updates", updates: Object.values(updates) });
    updates = {};
  }
};

export const clearUpdatesCache = () => {
  updates = {};
};
