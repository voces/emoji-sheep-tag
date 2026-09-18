/**
 * Load and register estb models for use in the game.
 */

import { scene } from "./three.ts";
import { loadEstb } from "./loadEstb.ts";
import { AnimatedInstancedMesh } from "./AnimatedInstancedMesh.ts";
import { createAnimatedMeshMaterial } from "./AnimatedMeshMaterial.ts";
import { OVERLAY_RENDER_ORDER, TRANSLUCENT_RENDER_ORDER } from "./depthSort.ts";

/**
 * Load an estb model and create an AnimatedInstancedMesh.
 */
export const loadEstbModel = (
  buffer: ArrayBuffer,
  modelName: string,
  options: {
    count?: number;
    layer?: number;
    zOrder: number;
    scale?: number;
    xOffset?: number;
    yOffset?: number;
    /** Draw over everything in render order instead of sorting by position. */
    overlay?: boolean;
    /** Sort this far south of the model's base, to cover things standing in it. */
    sortBias?: number;
  },
): AnimatedInstancedMesh => {
  const scale = options.scale ?? 1;
  const { geometry, animationData, cameras } = loadEstb(buffer, {
    scale,
    xOffset: options.xOffset,
    yOffset: options.yOffset,
  });

  const count = options.count ?? 0;
  geometry.computeBoundingBox();

  const mesh = options.overlay
    ? new AnimatedInstancedMesh(
      geometry,
      createAnimatedMeshMaterial("overlay"),
      count,
      modelName,
      animationData,
      { cameras, modelScale: scale },
    )
    : new AnimatedInstancedMesh(
      geometry,
      createAnimatedMeshMaterial("opaque"),
      count,
      modelName,
      animationData,
      {
        cameras,
        modelScale: scale,
        sort: {
          baseY: geometry.boundingBox?.min.y ?? 0,
          bias: options.sortBias ?? 0,
        },
        translucentMaterial: createAnimatedMeshMaterial("translucent"),
      },
    );

  mesh.renderOrder = options.overlay
    ? OVERLAY_RENDER_ORDER + options.zOrder
    : options.zOrder;
  // See-through instances draw after every opaque sprite: depth first, then color
  mesh.depthMesh.renderOrder = TRANSLUCENT_RENDER_ORDER + options.zOrder -
    0.001;
  mesh.translucentMesh.renderOrder = TRANSLUCENT_RENDER_ORDER + options.zOrder;

  if (typeof options.layer === "number") {
    for (const m of [mesh, mesh.depthMesh, mesh.translucentMesh]) {
      m.layers.set(options.layer);
    }
  }

  scene.add(mesh);
  if (!options.overlay) scene.add(mesh.depthMesh, mesh.translucentMesh);
  return mesh;
};
