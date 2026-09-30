import { type PerspectiveCamera, Vector3 } from "three";

const corner = new Vector3();

/**
 * Where on a minimap `shown` in CSS pixels the main camera's view of the ground
 * falls. Both cameras look straight down, so it stays an upright rectangle.
 */
export const cameraBoxOnMinimap = (
  main: PerspectiveCamera,
  minimap: PerspectiveCamera,
  shown: { width: number; height: number },
) => {
  const halfHeight = Math.tan((main.fov * Math.PI) / 360) * main.position.z;
  const halfWidth = halfHeight * main.aspect;
  const onMinimap = (x: number, y: number) => {
    corner.set(x, y, 0).project(minimap);
    return [
      (corner.x + 1) / 2 * shown.width,
      (1 - corner.y) / 2 * shown.height,
    ];
  };
  const [left, top] = onMinimap(
    main.position.x - halfWidth,
    main.position.y + halfHeight,
  );
  const [right, bottom] = onMinimap(
    main.position.x + halfWidth,
    main.position.y - halfHeight,
  );
  return { left, top, width: right - left, height: bottom - top };
};
