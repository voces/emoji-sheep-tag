import { Entity } from "@/shared/types.ts";
import { appContext } from "@/shared/context.ts";

export const removeEntity = (entity: Entity) => {
  appContext.current.removeEntity(entity);
};

export const addEntity = (entity: Partial<Entity>) =>
  appContext.current.addEntity(entity);
