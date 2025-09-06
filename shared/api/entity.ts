import { Entity } from "@/shared/types.ts";
import { appContext } from "@/shared/context.ts";
import { prefabs } from "@/shared/data.ts";
import { id } from "../util/id.ts";

export const removeEntity = (entity: Entity) => {
  appContext.current.removeEntity(entity);
};

export const mergeEntityWithPrefab = (
  entity: Partial<Entity>,
): Partial<Entity> => {
  if (!entity.id) {
    entity = { ...entity, id: id(entity.prefab) };
  }

  if (entity.maxHealth && typeof entity.health !== "number") {
    entity = { ...entity, health: entity.maxHealth };
  }

  if (!entity.prefab) return entity;

  const prefabData = prefabs[entity.prefab];
  if (!prefabData) return entity;

  if (typeof prefabData.maxHealth && typeof entity.health !== "number") {
    entity = { ...entity, health: prefabData.maxHealth };
  }

  return { ...prefabData, ...entity };
};

export const addEntity = (entity: Partial<Entity>) =>
  appContext.current.addEntity(mergeEntityWithPrefab(entity));
