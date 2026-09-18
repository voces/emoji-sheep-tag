import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import type { Material } from "three";
import { collections } from "../systems/models.ts";
import { instanceZ } from "./depthSort.ts";
import { terrain } from "./three.ts";

let nextId = 0;

const place = (model: string, x: number, y: number) => {
  const id = `depth-sort-${nextId++}`;
  collections[model]!.setPositionAt(id, x, y);
  return id;
};

const depth = (model: string, id: string) =>
  collections[model]!.getPositionAt(id).z;

const materialOf = (model: string) => collections[model]!.material as Material;

it("draws whichever sprite stands further south in front, across models", () => {
  const tree = place("tree", 10, 10);
  const wolfInFront = place("wolf", 10, 9);
  const wolfBehind = place("wolf", 10, 11);

  expect(depth("wolf", wolfInFront)).toBeGreaterThan(depth("tree", tree));
  expect(depth("wolf", wolfBehind)).toBeLessThan(depth("tree", tree));
});

it("sorts copies of the same model by position", () => {
  const north = place("hut", 20, 21);
  const south = place("hut", 20, 20);

  expect(depth("hut", south)).toBeGreaterThan(depth("hut", north));
});

it("sorts a sprite by the base of its drawing, so bigger copies sort lower", () => {
  const small = place("tree", 30, 30);
  const big = place("tree", 31, 30);
  collections.tree!.setScaleAt(big, 2);

  expect(depth("tree", big)).toBeGreaterThan(depth("tree", small));
});

it("hides a sheep standing behind a hay pile, but not one in front of it", () => {
  const pile = place("hayPile", 40, 40);
  const behind = place("sheep", 40, 40.4);
  const inFront = place("sheep", 40, 39.4);

  expect(depth("hayPile", pile)).toBeGreaterThan(depth("sheep", behind));
  expect(depth("sheep", inFront)).toBeGreaterThan(depth("hayPile", pile));
});

it("sorts a cover south of its base by its bias, so units hide inside it", () => {
  const at = (bias: number, y: number, baseY: number) =>
    instanceZ({ baseY, bias }, 40, y, 1, 0);
  const pile = at(0, 40, -0.36);
  const biasedPile = at(0.5, 40, -0.36);
  const sheep = at(0, 39.8, -0.25);

  expect(pile).toBeLessThan(sheep);
  expect(biasedPile).toBeGreaterThan(sheep);
});

it("sorts world sprites by depth and draws effects over everything", () => {
  for (const model of ["tree", "hut", "fence", "hayPile"]) {
    expect(materialOf(model).depthTest).toBe(true);
    expect(materialOf(model).depthWrite).toBe(true);
  }
  for (const model of ["sparkle", "fire", "location"]) {
    expect(materialOf(model).depthTest).toBe(false);
    expect(collections[model]!.renderOrder).toBeGreaterThan(
      collections.tree!.renderOrder,
    );
  }
});

it("draws see-through copies in a later pass that doesn't hide what's behind", () => {
  const blueprint = place("hut", 50, 50);
  const hut = collections.hut!;

  expect(hut.translucentMesh.visible).toBe(false);
  hut.setAlphaAt(blueprint, 0.75);
  expect(hut.translucentMesh.visible).toBe(true);
  expect(hut.translucentMesh.renderOrder).toBeGreaterThan(
    collections.tree!.renderOrder,
  );
  expect((hut.translucentMesh.material as Material).depthWrite).toBe(false);
  hut.setAlphaAt(blueprint, 1);
  expect(hut.translucentMesh.visible).toBe(false);
});

it("lets grass and reeds hide sprites by keeping the terrain's depth", () => {
  expect(terrain.material.depthWrite).toBe(true);
  expect(terrain.material.depthTest).toBe(true);
});
