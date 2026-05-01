import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getMaskShapeForBounds, isMaskEmpty, reanchorMask } from "./map.ts";

describe("getMaskShapeForBounds", () => {
  it("counts integer vertices strictly inside half-integer bounds", () => {
    // bounds (8.5, 8.5) → (87.5, 87.5): vertices at 9..87 = 79 cells.
    const shape = getMaskShapeForBounds({
      min: { x: 8.5, y: 8.5 },
      max: { x: 87.5, y: 87.5 },
    });
    expect(shape.width).toBe(79);
    expect(shape.height).toBe(79);
    expect(shape.firstVertexX).toBe(9);
    expect(shape.topVertexY).toBe(87);
  });

  it("includes the min boundary when it falls exactly on a vertex", () => {
    // Integer bounds: vertex at boundsMin is inside (worldX < min is the
    // exclusion rule), vertex at boundsMax is outside.
    const shape = getMaskShapeForBounds({
      min: { x: 0, y: 0 },
      max: { x: 4, y: 4 },
    });
    expect(shape.width).toBe(4);
    expect(shape.height).toBe(4);
    expect(shape.firstVertexX).toBe(0);
    expect(shape.topVertexY).toBe(3);
  });

  it("returns zero size for an empty boundary", () => {
    const shape = getMaskShapeForBounds({
      min: { x: 5, y: 5 },
      max: { x: 5, y: 5 },
    });
    expect(shape.width).toBe(0);
    expect(shape.height).toBe(0);
  });
});

describe("reanchorMask", () => {
  const oldBounds = { min: { x: 0.5, y: 0.5 }, max: { x: 4.5, y: 4.5 } };

  it("preserves cell values when bounds shift by an integer", () => {
    // 4×4 mask with one set cell.
    const mask = [
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    // Shift the boundary right by 1 (no shape change). Vertex coords shift,
    // so the set cell appears at one column to the left in the new mask.
    const shifted = reanchorMask(mask, oldBounds, {
      min: { x: 1.5, y: 0.5 },
      max: { x: 5.5, y: 4.5 },
    });
    expect(shifted).toEqual([
      [0, 0, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("drops cells outside a shrunken boundary", () => {
    const mask = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    // Shrink the right side by 2 (max.x: 4.5 → 2.5). The right two columns
    // (worldX 3, 4) are now out of bounds and their values must be dropped.
    const shrunk = reanchorMask(mask, oldBounds, {
      min: { x: 0.5, y: 0.5 },
      max: { x: 2.5, y: 4.5 },
    });
    expect(shrunk).toEqual([
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ]);
  });

  it("clamps to the nearest old edge when the boundary expands", () => {
    const mask = [
      [1, 0],
      [0, 1],
    ];
    const oldSmall = { min: { x: 0.5, y: 0.5 }, max: { x: 2.5, y: 2.5 } };
    const expanded = reanchorMask(mask, oldSmall, {
      min: { x: 0.5, y: 0.5 },
      max: { x: 3.5, y: 3.5 },
    });
    // New shape 3×3. The new vertices added by the expansion (top row and
    // right column in array space) clamp from the nearest old edge cell, so
    // a masked strip on the boundary "extrudes" outward instead of vanishing.
    // Old mask laid out at vertices: (1,1)=1, (2,1)=0 / (1,2)=0, (2,2)=1.
    // New top row (vy=3) clamps from old top row (vy=2). New right column
    // (vx=3) clamps from old right column (vx=2).
    expect(expanded).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [0, 1, 1],
    ]);
  });
});

describe("isMaskEmpty", () => {
  it("treats all-zero masks as empty", () => {
    expect(isMaskEmpty([])).toBe(true);
    expect(isMaskEmpty([[]])).toBe(true);
    expect(isMaskEmpty([[0, 0], [0, 0]])).toBe(true);
  });

  it("returns false as soon as any cell is set", () => {
    expect(isMaskEmpty([[0, 0], [0, 1]])).toBe(false);
    expect(isMaskEmpty([[2]])).toBe(false);
  });
});
