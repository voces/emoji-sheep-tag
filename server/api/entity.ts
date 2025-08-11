import { Entity } from "@/shared/types.ts";
import { currentApp } from "../contexts.ts";

export const deleteEntity = (entity: Entity) => {
  currentApp().removeEntity(entity);
};
