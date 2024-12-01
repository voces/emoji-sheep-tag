import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lobbyContext } from "../contexts.ts";

const data = new WeakMap<App<Entity>, Record<string, Entity | undefined>>();

export const lookup = (entityId: string) => {
  const app = lobbyContext.context.round?.ecs;
  if (!app) throw new Error("No round in progress");
  const entity = data.get(app)?.[entityId];
  // if (!entity) throw new Error(`Could not find entity ${entityId}`);
  return entity;
};

/** A system to track a reverse map for entity ids to entities */
export const addLookupSystem = (app: App<Entity>) => {
  const lookup: Record<string, Entity | undefined> = {};
  data.set(app, lookup);
  app.addSystem({
    props: ["id"],
    onAdd: (e) => {
      lookup[e.id] = e;
    },
    onRemove: (e) => {
      delete lookup[e.id];
    },
  });
  return lookup;
};
