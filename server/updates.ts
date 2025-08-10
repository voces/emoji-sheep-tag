import { Update } from "../client/client.ts";
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

// Keep kill messages for now since they're different from sound
const killMessages: Array<
  {
    type: "kill";
    killer: { player: string; unit: string };
    victim: { player: string; unit: string };
  }
> = [];

export const message = (
  message: {
    type: "kill";
    killer: { player: string; unit: string };
    victim: { player: string; unit: string };
  },
) => {
  killMessages.push(message);
};

export const flushUpdates = () => {
  const updatesArray: Update[] = Object.entries(updates).map(([id, update]) =>
    "__delete" in update
      ? { type: "delete", id }
      : { type: "unit", id, ...update }
  );
  updatesArray.push(...killMessages);
  if (updatesArray.length) {
    send({ type: "updates", updates: updatesArray });
    updates = {};
    killMessages.splice(0);
  }
};

export const clearUpdatesCache = () => {
  updates = {};
  killMessages.splice(0);
};
