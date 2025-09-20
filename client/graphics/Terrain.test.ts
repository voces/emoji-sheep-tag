import { it } from "@std/testing/bdd";
import { Terrain } from "./Terrain.ts";
import { expect } from "@std/expect";

it("1x1", () => {
  const terrain = new Terrain("0", "0");
  expect(terrain.pathingMap).toEqual([[8, 8], [8, 8]]);
});

it("1x1 cliff", () => {
  const terrain = new Terrain("0", "1");
  expect(terrain.pathingMap).toEqual([[8, 8], [8, 8]]);
});

it("1x1 tile", () => {
  const terrain = new Terrain("1", "0");
  expect(terrain.pathingMap).toEqual([[6, 6], [6, 6]]);
});

it("3x3", () => {
  const terrain = new Terrain("000\n000\n000", "000\n000\n000");
  expect(terrain.pathingMap).toEqual([
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8],
  ]);
});

it("3x3 center cliff", () => {
  const terrain = new Terrain("000\n000\n000", "000\n010\n000");
  expect(terrain.pathingMap).toEqual(
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
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n0110\n0110\n0000",
  );
  expect(terrain.pathingMap).toEqual(
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
  const terrain = new Terrain("111\n111\n111\n111", "000\n0r0\n010\n000");
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n0rr0\n0110\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain("1111\n1111\n1111", "0000\n01r0\n0000");
  expect(terrain.pathingMap).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide right ramp", () => {
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n01r0\n01r0\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain("111\n111\n111\n111", "000\n010\n0r0\n000");
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n0110\n0rr0\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain("1111\n1111\n1111", "0000\n0r10\n0000");
  expect(terrain.pathingMap).toEqual([
    [6, 6, 6, 6, 6, 6, 6, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 7, 7, 7, 7, 7, 7, 6],
    [6, 6, 6, 6, 6, 6, 6, 6],
  ]);
});

it("simple 2-wide left ramp", () => {
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n0r10\n0r10\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n01r0\n0rr0\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
  const terrain = new Terrain(
    "1111\n1111\n1111\n1111",
    "0000\n0rr0\n0r10\n0000",
  );
  expect(terrain.pathingMap).toEqual([
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
