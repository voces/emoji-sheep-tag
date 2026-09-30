import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from "three";
import { staticInstances } from "./staticMeshes.ts";

it("leaves an instanced mesh out of the draw while it holds no instances", () => {
  const mesh = staticInstances(
    new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 0),
  );
  expect(mesh.visible).toBe(false);

  mesh.count = 3;
  expect(mesh.visible).toBe(true);

  // Hidden on purpose, it stays hidden however many it holds
  mesh.visible = false;
  expect(mesh.visible).toBe(false);
  mesh.visible = true;
  mesh.count = 0;
  expect(mesh.visible).toBe(false);
});

it("never recomputes the matrix of a mesh that never moves", () => {
  const mesh = staticInstances(
    new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1),
  );
  expect(mesh.matrixAutoUpdate).toBe(false);
});
