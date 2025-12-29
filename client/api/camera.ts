import { Entity } from "../ecs.ts";
import { camera, onRender } from "../graphics/three.ts";

// Shared interpolation state for smooth camera movement
const interpolation = {
  isInterpolating: false,
  targetX: 0,
  targetY: 0,
};

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

/**
 * Smoothly pan the camera to a target position using interpolation
 */
export const panCameraTo = (x: number, y: number) => {
  interpolation.targetX = x;
  interpolation.targetY = y;
  interpolation.isInterpolating = true;
};

/**
 * Get the current interpolation state (for minimap integration)
 */
export const getCameraInterpolation = () => interpolation;

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

onRender((delta) => {
  if (followingEntity) focusEntity(followingEntity);

  // Handle smooth camera interpolation
  if (interpolation.isInterpolating) {
    const lerpFactor = Math.min(1, delta * 15);
    camera.position.x += (interpolation.targetX - camera.position.x) *
      lerpFactor;
    camera.position.y += (interpolation.targetY - camera.position.y) *
      lerpFactor;

    const dx = interpolation.targetX - camera.position.x;
    const dy = interpolation.targetY - camera.position.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.001) {
      interpolation.isInterpolating = false;
    }
  }
});
