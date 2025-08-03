import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lobbyContext } from "../contexts.ts";
import { addSystem } from "../ecs.ts";

const data = new WeakMap<App<Entity>, Record<string, Entity | undefined>>();

export const lookup = (entityId: string) => {
  const app = lobbyContext.context.round?.ecs;
  if (!app) return;
  const entity = data.get(app)?.[entityId];
  // if (!entity) throw new Error(`Could not find entity ${entityId}`);
  return entity;
};

addSystem((game) => {
  const lookup: Record<string, Entity | undefined> = {};
  data.set(game, lookup);
  return {
    props: ["id"],
    onAdd: (e) => {
      lookup[e.id] = e;
    },
    onRemove: (e) => {
      delete lookup[e.id];
    },
  };
});
