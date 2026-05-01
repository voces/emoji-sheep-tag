import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  getPathingMaskFromTerrainMasks,
  getWaterDepth,
  getWaterDepthAtWorld,
  getWaterLevel,
} from "@/shared/pathing/terrainHelpers.ts";
import {
  PATHING_BUILDABLE,
  PATHING_WALKABLE,
  WATER_LEVEL_SCALE,
} from "@/shared/constants.ts";

it("1x1", () => {
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[0]]);
  expect(terrain).toEqual([[0, 0], [0, 0]]);
});

it("1x1 cliff", () => {
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[1]]);
  expect(terrain).toEqual([[0, 0], [0, 0]]);
});

it("1x1 tile", () => {
  const terrain = getPathingMaskFromTerrainMasks([[1]], [[0]]);
  expect(terrain).toEqual([[6, 6], [6, 6]]);
});

it("3x3", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  );
  expect(terrain).toEqual([
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ]);
});

it("3x3 center cliff", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
  );
  expect(terrain).toEqual(
    [
      [0, 0, 0, 0, 0, 0],
      [0, 3, 3, 3, 3, 0],
      [0, 3, 3, 3, 3, 0],
      [0, 3, 3, 3, 3, 0],
      [0, 3, 3, 3, 3, 0],
      [0, 0, 0, 0, 0, 0],
    ],
  );
});

it("4x4 center cliff", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual(
    [
      [6, 6, 6, 6, 6, 6, 6, 6],
      [6, 7, 7, 7, 7, 7, 7, 6],
      [6, 7, 7, 7, 7, 7, 7, 6],
      [6, 7, 7, 6, 6, 7, 7, 6],
      [6, 7, 7, 6, 6, 7, 7, 6],
      [6, 7, 7, 7, 7, 7, 7, 6],
      [6, 7, 7, 7, 7, 7, 7, 6],
      [6, 6, 6, 6, 6, 6, 6, 6],
    ],
  );
});

it("simple 1-wide top ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[0, 0, 0], [0, "r", 0], [0, 1, 0], [0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide top ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, "r", "r", 0], [0, 1, 1, 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 1-wide right ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, 1, "r", 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide right ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, 1, "r", 0], [0, 1, "r", 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 1-wide bottom ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 1, 0], [0, "r", 0], [0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide bottom ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, 1, 1, 0], [0, "r", "r", 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 7, 7, 6, 6, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 1-wide left ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, "r", 1, 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide left ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, "r", 1, 0], [0, "r", 1, 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("bottom-right ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, 1, "r", 0], [0, "r", "r", 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 7, 7, 6, 6, 6, 6, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("top-left ramp", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]],
    [[0, 0, 0, 0], [0, "r", "r", 0], [0, "r", 1, 0], [0, 0, 0, 0]],
  );
  expect(terrain).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 6, 6, 6, 6, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("water shallow is buildable but walkable", () => {
  // Cliff at 0, water at 0.5: depth 0.5 < 0.75 → only BUILDABLE bit set
  const water = [[Math.round(0.5 * WATER_LEVEL_SCALE)]];
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[0]], water);
  expect(terrain).toEqual([
    [PATHING_BUILDABLE, PATHING_BUILDABLE],
    [PATHING_BUILDABLE, PATHING_BUILDABLE],
  ]);
});

it("water deep is both unbuildable and unwalkable", () => {
  // Cliff at 0, water at 1.0: depth 1.0 >= 0.75 → BUILDABLE | WALKABLE both set
  const water = [[Math.round(1.0 * WATER_LEVEL_SCALE)]];
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[0]], water);
  const expected = PATHING_BUILDABLE | PATHING_WALKABLE;
  expect(terrain).toEqual([[expected, expected], [expected, expected]]);
});

it("water above cliff leaves dry cell pathable", () => {
  // Cell is at cliff height 2, water at 1.5: dry → no water pathing
  const water = [[Math.round(1.5 * WATER_LEVEL_SCALE)]];
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[2]], water);
  expect(terrain).toEqual([[0, 0], [0, 0]]);
});

it("water missing mask means no water", () => {
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[0]]);
  expect(terrain).toEqual([[0, 0], [0, 0]]);
});

it("getWaterLevel returns cliff units from raw integer mask", () => {
  const mask = [[Math.round(1.5 * WATER_LEVEL_SCALE), 0]];
  expect(getWaterLevel(0, 0, mask)).toBe(1.5);
  expect(getWaterLevel(2, 0, mask)).toBe(0);
});

it("getWaterDepth uses interpolated cliff height on ramps", () => {
  // Column: [top=2, ramp, bottom=0], water everywhere at level 1.5
  // Ramp cell averages to 1, so depth there = 0.5 (shallow)
  const cliffMask: (number | "r")[][] = [[2], ["r"], [0]];
  const water = [[Math.round(1.5 * WATER_LEVEL_SCALE)], [
    Math.round(1.5 * WATER_LEVEL_SCALE),
  ], [Math.round(1.5 * WATER_LEVEL_SCALE)]];
  expect(getWaterDepth(0, 0, cliffMask, water)).toBeCloseTo(-0.5);
  expect(getWaterDepth(0, 2, cliffMask, water)).toBeCloseTo(0.5);
  expect(getWaterDepth(0, 4, cliffMask, water)).toBeCloseTo(1.5);
});

it("getWaterDepthAtWorld flips Y so worldY=0 is the bottom row", () => {
  // Column of height 3: row 0 (top of mask) dry at height 2, row 2 (bottom) at 0.
  // Water level 1.5 everywhere: top cell dry (-0.5), bottom cell deep (1.5).
  const cliffMask: (number | "r")[][] = [[2], [1], [0]];
  const water = [
    [Math.round(1.5 * WATER_LEVEL_SCALE)],
    [Math.round(1.5 * WATER_LEVEL_SCALE)],
    [Math.round(1.5 * WATER_LEVEL_SCALE)],
  ];
  // World Y=0 is bottom: should hit mask row 2 (height 0, depth 1.5).
  expect(getWaterDepthAtWorld(0, 0, cliffMask, water)).toBeCloseTo(1.5);
  // World Y at top of map (height 3 tiles → y=2.5 is top tile center).
  expect(getWaterDepthAtWorld(0, 2.5, cliffMask, water)).toBeCloseTo(-0.5);
});

it("manual mask blocks pathing on the cliff vertex 2x2 patch", () => {
  // 4x4 grass map, no bounds clamp. Mask is bounds-anchored (W+1)×(H+1) sized
  // on full extents, so width 5, height 5. Mark the vertex at world (2, 2).
  const tiles = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const cliffs: (number | "r")[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const water = tiles.map((r) => r.map(() => 0));
  const bounds = { min: { x: 0, y: 0 }, max: { x: 4, y: 4 } };
  const mask = Array.from({ length: 5 }, () => new Array(5).fill(0));
  // Vertex (2, 2): worldY 2, with topVertexY = ceil(4)-1 = 3, mapY=1.
  // worldX 2, firstVertexX = 0, mapX = 2.
  mask[1][2] = 1;
  const pathing = getPathingMaskFromTerrainMasks(
    tiles,
    cliffs,
    water,
    bounds,
    mask,
  );
  // The 2x2 pathing block touched is the four pathing cells whose worldX ∈
  // [1.5, 2.5) and worldY ∈ [1.5, 2.5). In unreversed pathing coords (py=0
  // top, py=2H-1 bottom): py corresponds to worldY = (2H-1-py)/2.
  // For worldY=1.5 → py=4, worldY=2 → py=3. So py ∈ {3, 4}, px ∈ {3, 4}.
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const isMaskedCell = (py === 3 || py === 4) && (px === 3 || px === 4);
      expect(pathing[py][px]).toBe(isMaskedCell ? 0xFF : 0);
    }
  }
});

it("manual mask is a noop when the boundary excludes the vertex", () => {
  const tiles = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const cliffs: (number | "r")[][] = tiles.map((r) =>
    r.map(() => 0 as number | "r")
  );
  const water = tiles.map((r) => r.map(() => 0));
  // Boundary excludes the outermost vertex layer.
  const bounds = { min: { x: 0.5, y: 0.5 }, max: { x: 3.5, y: 3.5 } };
  // Mask shape: ceil(3.5)-ceil(0.5) = 3 in each axis.
  const mask = [
    [1, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const pathing = getPathingMaskFromTerrainMasks(
    tiles,
    cliffs,
    water,
    bounds,
    mask,
  );
  // mapY=0, mapX=0 ⇒ vertex (firstVertexX=1, topVertexY=3) ⇒ world (1, 3).
  // 2x2 pathing block: worldX ∈ [0.5, 1.5), worldY ∈ [2.5, 3.5).
  // unreversed py: worldY=2.5 → py=1, worldY=3 → py=0; px: worldX=0.5 → px=1,
  // worldX=1 → px=2.
  expect(pathing[0][1]).toBe(0xFF);
  expect(pathing[0][2]).toBe(0xFF);
  expect(pathing[1][1]).toBe(0xFF);
  expect(pathing[1][2]).toBe(0xFF);
  // Cells outside the boundary are blocked too (via the bounds rule), but
  // strictly-interior cells away from the masked vertex remain walkable.
  expect(pathing[3][3]).toBe(0);
});

it("getWaterDepthAtWorld interpolates symmetrically across cell boundaries", () => {
  // 2x1 map: left cell wet (cliff 0, water 1.5, depth 1.5),
  // right cell dry (cliff 0, no water, depth 0). Shore is at worldX=1.0,
  // interpolation band is centered on it (roughly [0.75, 1.25]).
  const cliffMask: (number | "r")[][] = [[0, 0]];
  const water = [[Math.round(1.5 * WATER_LEVEL_SCALE), 0]];
  expect(getWaterDepthAtWorld(0.5, 0, cliffMask, water)).toBeCloseTo(1.5);
  expect(getWaterDepthAtWorld(1.0, 0, cliffMask, water)).toBeCloseTo(0.75);
  expect(getWaterDepthAtWorld(1.5, 0, cliffMask, water)).toBeCloseTo(0);

  // Mirror: the boundary value must match regardless of which side is wet.
  const mirroredWater = [[0, Math.round(1.5 * WATER_LEVEL_SCALE)]];
  expect(getWaterDepthAtWorld(0.5, 0, cliffMask, mirroredWater)).toBeCloseTo(0);
  expect(getWaterDepthAtWorld(1.0, 0, cliffMask, mirroredWater)).toBeCloseTo(
    0.75,
  );
  expect(getWaterDepthAtWorld(1.5, 0, cliffMask, mirroredWater)).toBeCloseTo(
    1.5,
  );
});
