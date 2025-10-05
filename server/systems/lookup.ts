import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { lobbyContext } from "../contexts.ts";
import { addSystem } from "@/shared/context.ts";

const data = new WeakMap<App<Entity>, Record<string, Entity | undefined>>();

export const lookup = (entityId: string | null | undefined) => {
  if (!entityId) return;

  const app = lobbyContext.current.round?.ecs;
  if (!app) return;

  return data.get(app)?.[entityId];
};

addSystem((app) => {
  const lookup: Record<string, Entity | undefined> = {};
  data.set(app, lookup);
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
