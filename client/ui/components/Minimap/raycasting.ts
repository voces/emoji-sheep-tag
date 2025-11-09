import {
  type OrthographicCamera,
  type PerspectiveCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { mouse } from "../../../mouse.ts";
import { type Entity } from "../../../ecs.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";

export const createMinimapRaycast = (
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera | OrthographicCamera,
) => {
  const raycaster = new Raycaster();
  raycaster.layers.set(0);
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const cameraSpace = new Vector2();
  const world3 = new Vector3();

  const performMinimapRaycast = () => {
    const rect = canvas.getBoundingClientRect();
    const x = mouse.pixels.x - rect.left;
    const y = mouse.pixels.y - rect.top;

    cameraSpace.x = (x / rect.width) * 2 - 1;
    cameraSpace.y = -(y / rect.height) * 2 + 1;

    raycaster.setFromCamera(cameraSpace, camera);
    raycaster.ray.intersectPlane(plane, world3);
    const worldPos = new Vector2(world3.x, world3.y);

    return { intersects: new ExtendedSet<Entity>(), world: worldPos };
  };

  const minimapRaycast = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    if (
      localX >= 0 && localX <= rect.width && localY >= 0 &&
      localY <= rect.height
    ) {
      return performMinimapRaycast();
    }
    return null;
  };

  mouse.customRaycast = minimapRaycast;

  return {
    dispose: () => {
      mouse.customRaycast = undefined;
    },
  };
};
