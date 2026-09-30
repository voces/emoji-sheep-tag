import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getFloodFillCells } from "./brush.ts";
import {
  buildPreviewCache,
  buildTilePreview,
  isPreviewCached,
  maskPreviewKey,
  selectionKey,
  tilePreviewKey,
} from "./previewCells.ts";

// Two regions of 0 split by a wall of 1 at x = 2
const grid = [
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
];
const size = { width: 5, height: 3 };
const valueAt = (x: number, y: number) => grid[y][x];
const fillAt = (x: number, y: number) =>
  getFloodFillCells(x, y, size.width, size.height, valueAt);

describe("tile fill preview cache", () => {
  const fillKey = (x: number, y: number, sel = selectionKey(undefined)) =>
    tilePreviewKey(
      "fill",
      "circle",
      x,
      y,
      size,
      `tile|raise|${sel}`,
      () => valueAt(x, y),
    );

  it("rebuilds when the cursor moves into a separate region with the same value", () => {
    const { cache } = buildTilePreview(fillKey(0, 0), fillAt(0, 0), undefined);

    expect(fillKey(4, 0)).toBe(cache.key);
    expect(isPreviewCached(cache, fillKey(4, 0), true, 4, 0)).toBe(false);
  });

  it("hits the cache while the cursor stays in the same region", () => {
    const { cache } = buildTilePreview(fillKey(0, 0), fillAt(0, 0), undefined);

    expect(isPreviewCached(cache, fillKey(1, 2), true, 1, 2)).toBe(true);
  });

  it("hits the cache inside the region but outside the selection", () => {
    const selection = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const sel = selectionKey(selection);
    const { cache, drawn } = buildTilePreview(
      fillKey(0, 0, sel),
      fillAt(0, 0),
      selection,
    );

    expect(drawn).toEqual([[0, 0]]);
    expect(isPreviewCached(cache, fillKey(1, 2, sel), true, 1, 2)).toBe(true);
  });
});

describe("mask fill preview cache", () => {
  const maskKey = (x: number, y: number) =>
    maskPreviewKey("mask", "fill", "circle", x, y, () => valueAt(x, y));

  it("hits the cache within a region and rebuilds across the wall", () => {
    const cache = buildPreviewCache(maskKey(3, 1), fillAt(3, 1));

    expect(isPreviewCached(cache, maskKey(4, 2), true, 4, 2)).toBe(true);
    expect(isPreviewCached(cache, maskKey(0, 0), true, 0, 0)).toBe(false);
  });
});
