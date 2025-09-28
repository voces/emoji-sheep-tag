import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getPathingMaskFromTerrainMasks } from "@/shared/pathing/terrainHelpers.ts";

it("1x1", () => {
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[0]]);
  expect(terrain).toEqual([[8, 8], [8, 8]]);
});

it("1x1 cliff", () => {
  const terrain = getPathingMaskFromTerrainMasks([[0]], [[1]]);
  expect(terrain).toEqual([[8, 8], [8, 8]]);
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
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
  ]);
});

it("3x3 center cliff", () => {
  const terrain = getPathingMaskFromTerrainMasks(
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
  );
  expect(terrain).toEqual(
    [
      [8, 8, 8, 8, 8, 8],
      [8, 11, 11, 11, 11, 8],
      [8, 11, 11, 11, 11, 8],
      [8, 11, 11, 11, 11, 8],
      [8, 11, 11, 11, 11, 8],
      [8, 8, 8, 8, 8, 8],
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
