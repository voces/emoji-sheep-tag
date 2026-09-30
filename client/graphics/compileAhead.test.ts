import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { watchForUncompiled } from "./compileAhead.ts";

it("needs a compile only when something with a new material joins a scene", () => {
  const material = new MeshBasicMaterial();
  const scene = new Scene().add(new Mesh(new BoxGeometry(), material));
  const overlay = new Scene();
  const watcher = watchForUncompiled([scene, overlay]);
  expect(watcher.needsCompile()).toBe(true);

  watcher.markCompiled();
  expect(watcher.needsCompile()).toBe(false);

  scene.add(new Mesh(new BoxGeometry(), material));
  expect(watcher.needsCompile()).toBe(false);

  const group = new Group();
  const nested = new Group();
  group.add(nested);
  nested.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  overlay.add(group);
  expect(watcher.needsCompile()).toBe(true);

  watcher.markCompiled();
  nested.add(new Mesh(new BoxGeometry(), [material, new MeshBasicMaterial()]));
  expect(watcher.needsCompile()).toBe(true);
});
