import { Entity } from "@/shared/types.ts";
import { send } from "./lobbyApi.ts";
import { isEditor } from "./api/st.ts";

let updates: Record<string, Entity & { __delete?: boolean }> = {};

export const newEntity = (entity: Entity) => {
  if (entity.type === "static" && !isEditor()) return;
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

export const remove = (entity: Entity) => {
  if (entity.type === "static" && !isEditor()) return;
  if (!updates[entity.id]) {
    updates[entity.id] = { id: entity.id, __delete: true };
  } else updates[entity.id].__delete = true;
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
