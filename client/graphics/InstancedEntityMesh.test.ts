import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  Frustum,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  Raycaster,
  Vector3,
} from "three";
import { InstancedSvg } from "./InstancedSvg.ts";
import { AnimatedInstancedMesh } from "./AnimatedInstancedMesh.ts";

const boxGeometry = () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const vertexCount = geometry.attributes.position.count;
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3),
  );
  geometry.setAttribute(
    "vertexOpacity",
    new BufferAttribute(new Float32Array(vertexCount).fill(1), 1),
  );
  return geometry;
};

const meshes = {
  InstancedSvg: (count: number) =>
    new InstancedSvg([boxGeometry()], new MeshBasicMaterial(), count, "test", {
      translucentMaterial: new MeshBasicMaterial(),
    }),
  AnimatedInstancedMesh: (count: number) =>
    new AnimatedInstancedMesh(
      boxGeometry(),
      new MeshBasicMaterial(),
      count,
      "test",
      undefined,
      { translucentMaterial: new MeshBasicMaterial() },
    ),
};

const attribute = (
  mesh: InstancedSvg | AnimatedInstancedMesh,
  name: string,
  index: number,
) => {
  const attr = mesh.geometry.getAttribute(name);
  return Array.from(
    { length: attr.itemSize },
    (_, c) => attr.array[index * attr.itemSize + c],
  );
};

const tint = (mesh: InstancedSvg | AnimatedInstancedMesh, index: number) =>
  mesh instanceof InstancedSvg
    ? [
      mesh.instanceColor!.getX(index),
      mesh.instanceColor!.getY(index),
      mesh.instanceColor!.getZ(index),
    ]
    : attribute(mesh, "instanceTint", index);

const visibleFrom = (
  mesh: InstancedSvg | AnimatedInstancedMesh,
  x: number,
  y: number,
) => {
  const camera = new OrthographicCamera(x - 2, x + 2, y + 2, y - 2, 0.1, 100);
  camera.position.set(0, 0, 50);
  camera.updateMatrixWorld();
  return new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  ).intersectsObject(mesh);
};

const pick = (
  mesh: InstancedSvg | AnimatedInstancedMesh,
  x: number,
  y: number,
) => {
  const raycaster = new Raycaster(
    new Vector3(x, y, 50),
    new Vector3(0, 0, -1),
  );
  return raycaster.intersectObject(mesh).map((i) => mesh.getId(i.instanceId!));
};

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

for (const [name, create] of Object.entries(meshes)) {
  describe(name, () => {
    it("carries every per-instance value along when a delete swaps the last instance in", () => {
      const mesh = create(4);
      mesh.setPositionAt("a", 1, 1);
      mesh.setPositionAt("b", 2, 2);
      mesh.setPositionAt("c", 3, 4, 0.5);
      mesh.setScaleAt("c", 2);
      mesh.setAlphaAt("c", 0.5);
      mesh.setPlayerColorAt("c", new Color(0.25, 0.5, 0.75));
      mesh.setVertexColorAt("c", new Color(0.1, 0.2, 0.3));
      mesh.setMinimapMaskAt("c", 1);
      mesh.setSubmergenceAt("c", 0.4);
      const before = {
        alpha: attribute(mesh, "instanceAlpha", 2),
        mask: attribute(mesh, "instanceMinimapMask", 2),
        player: attribute(mesh, "instancePlayerColor", 2),
        tint: tint(mesh, 2),
        position: mesh.getPositionAt("c"),
      };

      mesh.delete("a");

      expect(mesh.getId(0)).toBe("c");
      expect(mesh.getId(2)).toBeUndefined();
      expect(attribute(mesh, "instanceAlpha", 0)).toEqual(before.alpha);
      expect(attribute(mesh, "instanceMinimapMask", 0)).toEqual(before.mask);
      expect(attribute(mesh, "instancePlayerColor", 0)).toEqual(before.player);
      expect(tint(mesh, 0)).toEqual(before.tint);
      expect(mesh.getPositionAt("c")).toEqual(before.position);
      expect(mesh.getPositionAt(2).x).toBe(Infinity);
    });

    it("keeps instances and their values when it grows, and gives new ones defaults", () => {
      const mesh = create(1);
      mesh.setPositionAt("a", 5, 6);
      mesh.setAlphaAt("a", 0.5);
      mesh.setPlayerColorAt("a", new Color(1, 0, 0));
      for (const id of ["b", "c", "d", "e"]) mesh.setPositionAt(id, 0, 0);

      expect(mesh.getCount()).toBeGreaterThanOrEqual(5);
      expect(mesh.count).toBe(mesh.getCount());
      expect(mesh.getPositionAt("a").x).toBe(5);
      expect(attribute(mesh, "instanceAlpha", 0)).toEqual([0.5]);
      expect(attribute(mesh, "instancePlayerColor", 0)).toEqual([1, 0, 0]);
      expect(attribute(mesh, "instanceAlpha", 4)).toEqual([1]);
      expect(attribute(mesh, "instanceMinimapMask", 4)).toEqual([0]);
      expect(attribute(mesh, "instancePlayerColor", 4)).toEqual([1, 1, 1]);
      expect(tint(mesh, 4)).toEqual([1, 1, 1]);
      expect(mesh.getPositionAt(mesh.getCount() - 1).x).toBe(Infinity);
    });

    it("resets a reused slot to defaults", () => {
      const mesh = create(2);
      mesh.setPositionAt("a", 0, 0);
      mesh.setAlphaAt("a", 0.5);
      mesh.setVertexColorAt("a", new Color(1, 0, 0));
      mesh.setMinimapMaskAt("a", 1);
      mesh.delete("a");
      mesh.setPositionAt("b", 0, 0);

      expect(attribute(mesh, "instanceAlpha", 0)).toEqual([1]);
      expect(attribute(mesh, "instanceMinimapMask", 0)).toEqual([0]);
      expect(tint(mesh, 0)).toEqual([1, 1, 1]);
    });

    it("draws the translucent pass only while an instance is see-through", () => {
      const mesh = create(4);
      mesh.setPositionAt("a", 0, 0);
      mesh.setPositionAt("b", 1, 1);
      expect(mesh.translucentMesh.visible).toBe(false);

      mesh.setAlphaAt("a", 0.5);
      mesh.setAlphaAt("a", 0.25);
      mesh.setAlphaAt("b", 0.5);
      expect(mesh.translucentMesh.visible).toBe(true);

      mesh.setAlphaAt("a", 1);
      expect(mesh.translucentMesh.visible).toBe(true);
      mesh.delete("b");
      expect(mesh.translucentMesh.visible).toBe(false);
    });

    it("shares its instances with its pass meshes as it grows", () => {
      const mesh = create(1);
      for (const id of ["a", "b", "c"]) mesh.setPositionAt(id, 0, 0);
      mesh.setAlphaAt("c", 0.5);
      expect(mesh.translucentMesh.instanceMatrix).toBe(mesh.instanceMatrix);
      expect(mesh.translucentMesh.count).toBe(mesh.count);
    });

    it("culls by bounds that follow its instances as they move", async () => {
      const mesh = create(4);
      mesh.setPositionAt("a", 0, 0);
      await tick();
      expect(visibleFrom(mesh, 0, 0)).toBe(true);
      expect(visibleFrom(mesh, 100, 100)).toBe(false);

      mesh.setPositionAt("a", 100, 100);
      await tick();
      expect(visibleFrom(mesh, 100, 100)).toBe(true);
      expect(visibleFrom(mesh, 0, 0)).toBe(false);

      mesh.setScaleAt("a", 50);
      await tick();
      expect(visibleFrom(mesh, 120, 120)).toBe(true);
    });

    it("keeps culling by current bounds once its instances span the map", async () => {
      const mesh = create(4);
      mesh.setPositionAt("a", -10000, -10000);
      mesh.setPositionAt("b", 10000, 10000);
      await tick();
      expect(visibleFrom(mesh, 10000, 10000)).toBe(true);

      mesh.setPositionAt("b", 30000, 30000);
      await tick();
      expect(visibleFrom(mesh, 30000, 30000)).toBe(true);
    });

    it("picks instances where they are", async () => {
      const mesh = create(4);
      mesh.setPositionAt("a", 0, 0);
      mesh.setPositionAt("b", 10, 10);
      await tick();
      expect(pick(mesh, 0, 0)).toEqual(["a"]);
      expect(pick(mesh, 10, 10)).toEqual(["b"]);

      mesh.delete("a");
      await tick();
      expect(pick(mesh, 0, 0)).toEqual([]);
      expect(pick(mesh, 10, 10)).toEqual(["b"]);
    });
  });
}

it("AnimatedInstancedMesh draws a depth pre-pass only while an instance is see-through", () => {
  const mesh = meshes.AnimatedInstancedMesh(2);
  mesh.setPositionAt("a", 0, 0);
  expect(mesh.depthMesh.visible).toBe(false);
  mesh.setAlphaAt("a", 0.5);
  expect(mesh.depthMesh.visible).toBe(true);
  expect(mesh.depthMesh.instanceMatrix).toBe(mesh.instanceMatrix);
  mesh.setAlphaAt("a", 1);
  expect(mesh.depthMesh.visible).toBe(false);
});

it("AnimatedInstancedMesh carries animation state along when a delete swaps instances", () => {
  const mesh = meshes.AnimatedInstancedMesh(1);
  mesh.setPositionAt("a", 0, 0);
  mesh.setAnimationAt("a", 5, 0.75, 3);
  mesh.setPositionAt("b", 0, 0);
  mesh.setAnimationAt("b", 3, 0.25, 2);
  mesh.setAnimationAt("b", 4, 0.5, 1, true);
  const anim = attribute(mesh, "instanceAnim", 1);

  mesh.delete("a");
  mesh.setPositionAt("c", 0, 0);

  expect(attribute(mesh, "instanceAnim", 0)).toEqual(anim);
  expect(attribute(mesh, "instanceAnimB", 0)).toEqual([3, 0.25, 2, 1]);
  expect(attribute(mesh, "instanceAnim", 1)).toEqual(
    attribute(mesh, "instanceAnim", 2),
  );
  expect(attribute(mesh, "instanceAnimB", 1)).toEqual([0, 0, 0, 0]);
});

it("InstancedSvg counts progressive build alpha as see-through", () => {
  const mesh = meshes.InstancedSvg(2);
  mesh.setPositionAt("a", 0, 0);
  mesh.setAlphaAt("a", 1, true);
  expect(mesh.translucentMesh.visible).toBe(true);
  expect(attribute(mesh, "instanceAlpha", 0)).toEqual([3]);
  mesh.setAlphaAt("a", 1);
  expect(mesh.translucentMesh.visible).toBe(false);
});

it("InstancedSvg keeps saved tints across a restore", () => {
  const mesh = meshes.InstancedSvg(2);
  mesh.setPositionAt("a", 0, 0);
  mesh.setVertexColorAt("a", new Color(0.5, 0.25, 1));
  const saved = mesh.saveInstanceColors("a");
  mesh.setVertexColorAt("a", new Color(1, 1, 1));
  mesh.restoreInstanceColors("a", saved);
  expect(tint(mesh, 0)).toEqual([0.5, 0.25, 1]);
});
