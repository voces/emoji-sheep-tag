/**
 * Load and register estb models for use in the game.
 */

import { scene } from "./three.ts";
import { loadEstb } from "./loadEstb.ts";
import { AnimatedInstancedMesh } from "./AnimatedInstancedMesh.ts";
import { getAnimatedMeshMaterial } from "./AnimatedMeshMaterial.ts";

/**
 * Load an estb model and create an AnimatedInstancedMesh.
 */
export const loadEstbModel = (
  buffer: ArrayBuffer,
  options: {
    count?: number;
    layer?: number;
    zOrder: number;
    scale?: number;
  },
): AnimatedInstancedMesh => {
  const scale = options.scale ?? 1;
  const { geometry, animationData, parts } = loadEstb(buffer, { scale });

  const material = getAnimatedMeshMaterial();
  const count = options.count ?? 0;

  const mesh = new AnimatedInstancedMesh(
    geometry,
    material,
    count,
    `estb-${parts.length}parts`,
    animationData,
  );

  if (typeof options.layer === "number") {
    mesh.layers.set(options.layer);
  }

  mesh.renderOrder = options.zOrder;

  // Depth mesh renders just before color pass (tiny offset to stay in same logical layer)
  mesh.depthMesh.renderOrder = options.zOrder - 0.001;
  if (typeof options.layer === "number") {
    mesh.depthMesh.layers.set(options.layer);
  }
  scene.add(mesh.depthMesh);

  scene.add(mesh);
  return mesh;
};
