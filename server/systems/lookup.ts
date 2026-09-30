import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { lobbyContext } from "../contexts.ts";
import { addSystem } from "@/shared/context.ts";

const data = new WeakMap<App<Entity>, Map<string, Entity>>();

export const lookup = (entityId: string | null | undefined) => {
  if (!entityId) return;

  const app = lobbyContext.current.round?.ecs;
  if (!app) return;

  return data.get(app)?.get(entityId);
};

addSystem((app) => {
  const lookup = new Map<string, Entity>();
  data.set(app, lookup);
  return {
    props: ["id"],
    onAdd: (e) => lookup.set(e.id, e),
    onRemove: (e) => lookup.delete(e.id),
  };
});
