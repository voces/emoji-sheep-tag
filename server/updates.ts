import { GameMessage, Update } from "../client/client.ts";
import { Entity } from "@/shared/types.ts";
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

const messages: GameMessage[] = [];

export const message = (message: GameMessage) => {
  messages.push(message);
};

export const flushUpdates = () => {
  const updatesArray: Update[] = Object.entries(updates).map(([id, update]) =>
    "__delete" in update
      ? ({ type: "delete", id })
      : ({ type: "unit", id, ...update })
  );
  updatesArray.push(...messages);
  if (updatesArray.length) {
    send({ type: "updates", updates: updatesArray });
    updates = {};
    messages.splice(0);
  }
};

export const clearUpdatesCache = () => {
  updates = {};
  messages.splice(0);
};
