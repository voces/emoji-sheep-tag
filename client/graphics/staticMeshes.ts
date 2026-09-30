import type { InstancedMesh } from "three";

/**
 * Readies an instanced mesh that stays put while its instances move: drawn
 * only while it holds any, since an empty one still costs the renderer a draw
 * each frame, and with its own matrix never recomputed, since every render
 * would otherwise redo it for nothing. Returns the mesh.
 */
export const staticInstances = <T extends InstancedMesh>(mesh: T): T => {
  let shown = mesh.visible;
  Object.defineProperty(mesh, "visible", {
    get: () => shown && mesh.count > 0,
    set: (value: boolean) => {
      shown = value;
    },
    configurable: true,
  });
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
};
