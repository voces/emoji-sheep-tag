import { addSystem, appContext } from "@/shared/context.ts";
import { Entity, SystemEntity } from "@/shared/types.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import type { App } from "@verit/ecs";

// Track all entities with selectedBy per app/game instance
const entitiesWithSelection = new Map<
  App<Entity>,
  ExtendedSet<Entity>
>();

// System that tracks entities with selectedBy (created per app instance)
addSystem((app) => {
  const selectedEntities = new ExtendedSet<Entity>();
  entitiesWithSelection.set(app, selectedEntities);

  return {
    props: ["selectedBy"],
    entities: selectedEntities as ExtendedSet<SystemEntity<"selectedBy">>,
  };
});

export const getEntitiesWithSelection = (): ReadonlySet<Entity> | undefined =>
  entitiesWithSelection.get(appContext.current);
