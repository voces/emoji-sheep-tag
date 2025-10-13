import { Entity } from "../ecs.ts";
import { camera } from "../graphics/three.ts";

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
