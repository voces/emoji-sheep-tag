import { Entity } from "../shared/types.ts";
import { send } from "./lobbyApi.ts";

let updates: Record<string, Partial<Entity>> = {};

export const newEntity = (entity: Entity) => {
  updates[entity.id] = entity;
};

export const update = <K extends keyof Entity>(
  entityId: string,
  prop: K,
  value: Entity[K],
) => {
  if (!updates[entityId]) {
    updates[entityId] = { [prop]: value } as Partial<Entity>;
  } else updates[entityId][prop] = value;
};

export const remove = (entityId: string) => {
  updates[entityId] = { __delete: true } as Partial<Entity>;
};

export const flushUpdates = () => {
  const updatesArray = Object.entries(updates).map(([id, update]) =>
    "__delete" in update
      ? ({ type: "delete" as const, id })
      : ({ type: "unit" as const, id, ...update })
  );
  if (updatesArray.length) {
    send({ type: "updates", updates: updatesArray });
    updates = {};
  }
};

export const clearUpdates = () => {
  updates = {};
};
