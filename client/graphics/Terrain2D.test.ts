import { expect } from "@std/expect";
import { buildCliffTexture, type CliffMask, Terrain2D } from "./Terrain2D.ts";
import type { ShaderMaterial } from "three";

const example1CliffMask: CliffMask = [
  [1, 1, 1],
  [1, "r", 1],
  [1, 2, 1],
  [1, 1, 1],
];

const example2CliffMask: CliffMask = [
  [1, 1, 1, 1],
  [1, "r", "r", 1],
  [1, 2, 2, 1],
  [1, 1, 1, 1],
];

const example3CliffMask: CliffMask = [
  [1, 1, 1, 1, 1],
  [1, 2, 2, 2, 1],
  [1, 2, 2, 2, 1],
  [1, 2, 2, 2, 1],
  [1, 1, 1, 1, 1],
];

const createTerrain = (cliffMask: CliffMask) =>
  new Terrain2D(
    {
      cliff: cliffMask,
      groundTile: cliffMask.map((r) => r.map(() => 0)),
      cliffTile: cliffMask.map((r) => r.map(() => 1)),
    },
    [
      { color: "#90ee90" },
      { color: "#ffdc41" },
    ],
  );

const getHeightData = (terrain: Terrain2D): Float32Array => {
  const mat = terrain.material as ShaderMaterial;
  return mat.uniforms.heightMap.value.image.data;
};

const getTexSize = (terrain: Terrain2D): { w: number; h: number } => {
  const mat = terrain.material as ShaderMaterial;
  const tex = mat.uniforms.heightMap.value;
  return { w: tex.image.width, h: tex.image.height };
};

Deno.test("Terrain2D creates textures with correct dimensions", () => {
  const t1 = createTerrain(example1CliffMask);
  const s1 = getTexSize(t1);
  expect(s1.w).toBe(6);
  expect(s1.h).toBe(8);

  const t2 = createTerrain(example2CliffMask);
  const s2 = getTexSize(t2);
  expect(s2.w).toBe(8);
  expect(s2.h).toBe(8);
});

Deno.test("Terrain2D height texture contains correct values for flat terrain", () => {
  const flatMask: CliffMask = [
    [1, 1],
    [1, 1],
  ];
  const terrain = createTerrain(flatMask);
  const data = getHeightData(terrain);
  for (let i = 0; i < data.length; i++) expect(data[i]).toBe(1);
});

Deno.test("Terrain2D height texture reflects height differences", () => {
  const terrain = createTerrain(example3CliffMask);
  const data = getHeightData(terrain);
  const { w } = getTexSize(terrain);
  // Center of the mask is height 2, edges are height 1
  // Doubled grid: mask (2,2) -> doubled (4,4) and (5,5)
  expect(data[4 * w + 4]).toBe(2);
  expect(data[5 * w + 5]).toBe(2);
  // Corner (0,0) -> doubled (0,0) should be height 1
  expect(data[0]).toBe(1);
});

Deno.test("Terrain2D flat plateau has uniform height", () => {
  const terrain = createTerrain(example3CliffMask);
  const data = getHeightData(terrain);
  const { w } = getTexSize(terrain);
  // Interior of height-2 plateau should all be 2
  expect(data[4 * w + 4]).toBe(2);
  expect(data[5 * w + 5]).toBe(2);
  expect(data[4 * w + 5]).toBe(2);
  expect(data[5 * w + 4]).toBe(2);
});

Deno.test("Terrain2D getCliff returns correct values", () => {
  const terrain = createTerrain(example3CliffMask);
  expect(terrain.getCliff(0, 0)).toBe(1);
  expect(terrain.getCliff(2, 2)).toBe(2);
});

Deno.test("Terrain2D setCliff updates height", () => {
  const terrain = createTerrain(example3CliffMask);
  expect(terrain.getCliff(2, 2)).toBe(2);
  terrain.setCliff(2, 2, 3);
  expect(terrain.getCliff(2, 2)).toBe(3);
  // Verify texture was rebuilt
  const data = getHeightData(terrain);
  const { w } = getTexSize(terrain);
  expect(data[4 * w + 4]).toBe(3);
});

Deno.test("Terrain2D setGroundTile updates tile data", () => {
  const terrain = createTerrain(example1CliffMask);
  terrain.setGroundTile(0, 0, 1);
  expect(terrain.masks.groundTile[0][0]).toBe(1);
  // Tile color texture should reflect the change
  const mat = terrain.material as ShaderMaterial;
  const tileData: Uint8Array = mat.uniforms.tileColorMap.value.image.data;
  // Tile 1 is #ffdc41 -> (255, 220, 65)
  expect(tileData[0]).toBe(255);
  expect(tileData[1]).toBe(220);
  expect(tileData[2]).toBe(65);
});

Deno.test("Terrain2D load rebuilds with new data", () => {
  const terrain = createTerrain(example1CliffMask);
  const newMask: CliffMask = [[2, 2], [2, 2]];
  terrain.load(
    {
      cliff: newMask,
      groundTile: [[0, 0], [0, 0]],
      cliffTile: [[1, 1], [1, 1]],
    },
    [{ color: "#90ee90" }, { color: "#ffdc41" }],
  );
  const { w, h } = getTexSize(terrain);
  expect(w).toBe(4);
  expect(h).toBe(4);
  expect(terrain.getCliff(0, 0)).toBe(2);
});

Deno.test("Terrain2D ramp produces interpolated height", () => {
  const terrain = createTerrain(example1CliffMask);
  const rampHeight = terrain.getCliff(1, 1);
  expect(rampHeight).toBe(1);
});

const getCliffData = (
  mask: CliffMask,
): { data: Uint8Array; w: number; h: number } => {
  const tex = buildCliffTexture(mask);
  return {
    data: tex.image.data as Uint8Array,
    w: tex.image.width,
    h: tex.image.height,
  };
};

const cliffAt = (cd: { data: Uint8Array; w: number }, x: number, y: number) =>
  cd.data[y * cd.w + x];

Deno.test("cliff distance field - simple cliff has ring with flat top", () => {
  const cd = getCliffData([
    [1, 1, 1, 1, 1],
    [1, 2, 2, 2, 1],
    [1, 2, 2, 2, 1],
    [1, 2, 2, 2, 1],
    [1, 1, 1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  expect(cd.w).toBe(20);
  expect(cd.h).toBe(20);
  // Ground corner: far from boundary (no cliff)
  expect(cliffAt(cd, 0, 0)).toBeGreaterThan(threshold);
  // Cliff boundary: cliff
  expect(cliffAt(cd, 4, 4)).toBeGreaterThan(0);
  expect(cliffAt(cd, 4, 4)).toBeLessThan(threshold);
  // Flat top center: ground (dist above threshold)
  expect(cliffAt(cd, 10, 10)).toBeGreaterThan(threshold);
});

Deno.test("cliff distance field - nested cliff has separate rings", () => {
  const cd = getCliffData([
    [1, 1, 1, 1, 1],
    [1, 2, 2, 2, 1],
    [1, 2, 3, 2, 1],
    [1, 2, 2, 2, 1],
    [1, 1, 1, 1, 1],
  ]);
  // Outer boundary (1→2): cliff
  const outer = cliffAt(cd, 7, 3);
  expect(outer).toBeGreaterThan(0);
  expect(outer).toBeLessThan(Math.round(0.35 / 2 * 255));
  // Inner boundary (2→3): cliff
  const inner = cliffAt(cd, 9, 7);
  expect(inner).toBeGreaterThan(0);
  expect(inner).toBeLessThan(Math.round(0.35 / 2 * 255));
  // Between rings (height 2 plateau): ground
  const plateau = cliffAt(cd, 5, 5);
  expect(plateau).toBeGreaterThan(Math.round(0.35 / 2 * 255));
});

Deno.test("cliff distance field - ramp has walls and open parallel edges", () => {
  const cd = getCliffData([
    [1, 1, 1],
    [1, "r", 1],
    [1, 2, 1],
    [1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  // Ramp wall sub-pixel (perpendicular edge): cliff
  expect(cliffAt(cd, 4, 5)).toBeLessThan(threshold);
  // Ramp parallel edge (entrance/exit): no cliff
  expect(cliffAt(cd, 5, 0)).toBeGreaterThan(threshold);
});

Deno.test("cliff distance field - ramp walls on perpendicular sides", () => {
  const cd = getCliffData([
    [1, 1, 1, 1],
    [1, 2, 2, 1],
    [1, 2, 1, 1],
    [1, 2, "r", 1],
    [1, 1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  // Ramp wall: perpendicular edge at top of ramp cell
  const rampWall = cliffAt(cd, 9, 12);
  expect(rampWall).toBeGreaterThan(0);
  expect(rampWall).toBeLessThan(threshold);
  // Ramp wall: perpendicular edge at bottom of ramp cell
  const rampWallBot = cliffAt(cd, 9, 15);
  expect(rampWallBot).toBeGreaterThan(0);
  expect(rampWallBot).toBeLessThan(threshold);
});

Deno.test("cliff distance field - ramp wall extends into adjacent cell", () => {
  const cd = getCliffData([
    [1, 1, 1, 1],
    [1, 2, 2, 1],
    [1, 2, 1, 1],
    [1, 2, "r", 1],
    [1, 1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  // Length extension: sub-pixel in adjacent ground cell along ramp direction
  const extended = cliffAt(cd, 13, 15);
  expect(extended).toBeGreaterThan(0);
  expect(extended).toBeLessThan(threshold);
});

Deno.test("cliff distance field - perpendicular extension from ramp wall", () => {
  const cd = getCliffData([
    [1, 1, 1, 1],
    [1, 2, 2, 1],
    [1, 2, 1, 1],
    [1, 2, "r", 1],
    [1, 1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  // Perpendicular extension: sub-pixel in ground cell adjacent to ramp wall
  const perpExt = cliffAt(cd, 8, 16);
  expect(perpExt).toBeGreaterThan(0);
  expect(perpExt).toBeLessThan(threshold);
});

Deno.test("cliff distance field - side-by-side ramps have no wall between", () => {
  const cd = getCliffData([
    [1, 1, 1, 1, 1],
    [1, 2, 2, 2, 1],
    [1, 2, "r", 1, 1],
    [1, 2, "r", 1, 1],
    [1, 1, 1, 1, 1],
  ]);
  const threshold = Math.round(0.35 / 2 * 255);
  // Shared edge between two ramps: should be open (no wall)
  // Ramps at mask (2,2) and (3,2), shared edge at y=12
  // Center of shared edge
  const between = cliffAt(cd, 10, 12);
  expect(between).toBeGreaterThan(threshold);
});
