import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getAllCells, getBrushCells, getFloodFillCells } from "./brush.ts";

const sortCells = (cells: [number, number][]) =>
  [...cells].sort(([ax, ay], [bx, by]) => ay - by || ax - bx);

describe("getBrushCells", () => {
  it("size 1 returns the single center cell", () => {
    expect(getBrushCells(3, 4, 1, "square", 10, 10)).toEqual([[3, 4]]);
  });

  it("size 1 outside bounds returns nothing", () => {
    expect(getBrushCells(-1, 0, 1, "square", 10, 10)).toEqual([]);
    expect(getBrushCells(0, 10, 1, "square", 10, 10)).toEqual([]);
  });

  it("square size 2 covers a 3x3 block", () => {
    const cells = sortCells(getBrushCells(5, 5, 2, "square", 20, 20));
    expect(cells.length).toBe(9);
    expect(cells[0]).toEqual([4, 4]);
    expect(cells[8]).toEqual([6, 6]);
  });

  it("square size 3 covers a 5x5 block", () => {
    expect(getBrushCells(5, 5, 3, "square", 20, 20).length).toBe(25);
  });

  it("clamps brush cells to map bounds", () => {
    const cells = getBrushCells(0, 0, 3, "square", 10, 10);
    for (const [x, y] of cells) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
    expect(cells.length).toBe(9);
  });

  it("circle excludes far corners while keeping a recognisable disc", () => {
    const square = getBrushCells(5, 5, 3, "square", 20, 20).length;
    const circle = getBrushCells(5, 5, 3, "circle", 20, 20).length;
    expect(circle).toBeLessThan(square);
    expect(circle).toBeGreaterThan(0);
    const corners: [number, number][] = [[3, 3], [7, 3], [3, 7], [7, 7]];
    const set = new Set(
      getBrushCells(5, 5, 3, "circle", 20, 20).map(([x, y]) => `${x},${y}`),
    );
    for (const [x, y] of corners) expect(set.has(`${x},${y}`)).toBe(false);
    expect(set.has("5,5")).toBe(true);
    expect(set.has("3,5")).toBe(true);
    expect(set.has("5,3")).toBe(true);
  });
});

describe("getFloodFillCells", () => {
  const grid = [
    [1, 1, 2, 2],
    [1, 1, 2, 2],
    [3, 3, 2, 2],
    [3, 3, 3, 4],
  ];
  const get = (x: number, y: number) => grid[y][x];

  it("returns the connected region matching the start value", () => {
    const cells = sortCells(getFloodFillCells(0, 0, 4, 4, get));
    expect(cells).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
  });

  it("does not cross diagonals", () => {
    // (3,3) is value 4, surrounded by 3s and 2s. Should only return itself.
    expect(getFloodFillCells(3, 3, 4, 4, get)).toEqual([[3, 3]]);
  });

  it("returns the whole map when every cell matches", () => {
    const uniform = (_x: number, _y: number) => 7;
    expect(getFloodFillCells(0, 0, 3, 3, uniform).length).toBe(9);
  });

  it("returns empty for out-of-bounds start", () => {
    expect(getFloodFillCells(-1, 0, 4, 4, get)).toEqual([]);
  });
});

describe("getAllCells", () => {
  it("emits every cell once", () => {
    const cells = getAllCells(3, 2);
    expect(cells.length).toBe(6);
    expect(new Set(cells.map(([x, y]) => `${x},${y}`)).size).toBe(6);
  });
});
