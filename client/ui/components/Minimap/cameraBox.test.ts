import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { PerspectiveCamera } from "three";
import { cameraBoxOnMinimap } from "./cameraBox.ts";

/** A camera looking straight down at the ground from `z` over (`x`, `y`). */
const lookingDown = (x: number, y: number, z: number, aspect = 1) => {
  const camera = new PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(x, y, z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
};

it("frames the main camera's view where it lies on the minimap", () => {
  const minimap = lookingDown(50, 50, 65);
  const shown = { width: 200, height: 200 };

  const centred = cameraBoxOnMinimap(
    lookingDown(50, 50, 9, 16 / 9),
    minimap,
    shown,
  );
  expect(centred.left + centred.width / 2).toBeCloseTo(100, 5);
  expect(centred.top + centred.height / 2).toBeCloseTo(100, 5);
  // As wide against as tall as the main view
  expect(centred.width / centred.height).toBeCloseTo(16 / 9, 5);

  // Looking further east and north moves it right and up the minimap
  const moved = cameraBoxOnMinimap(
    lookingDown(60, 60, 9, 16 / 9),
    minimap,
    shown,
  );
  expect(moved.left).toBeGreaterThan(centred.left);
  expect(moved.top).toBeLessThan(centred.top);
  expect(moved.width).toBeCloseTo(centred.width, 5);
});
