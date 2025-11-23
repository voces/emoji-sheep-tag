import { Entity } from "../ecs.ts";
import { camera, onRender } from "../graphics/three.ts";

export const focusGroup = (entities: Set<Entity>) => {
  let tx = 0;
  let ty = 0;

  for (const e of entities) {
    tx += e.position?.x ?? 0;
    ty += e.position?.y ?? 0;
  }

  camera.position.x = tx / entities.size;
  camera.position.y = ty / entities.size;
};

export const focusEntity = (entity: Entity | undefined) => {
  if (!entity?.position) return;
  camera.position.x = entity.position.x;
  camera.position.y = entity.position.y;
};

let followingEntity: Entity | undefined;

export const startFollowingEntity = (entity: Entity | undefined) => {
  if (!entity?.position) return;
  followingEntity = entity;
  focusEntity(entity);
};

export const stopFollowingEntity = () => {
  followingEntity = undefined;
};

export const getFollowingEntity = () => followingEntity;

onRender(() => {
  if (followingEntity) {
    focusEntity(followingEntity);
  }
});
