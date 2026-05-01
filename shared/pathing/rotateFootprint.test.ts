import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import {
  facingToQuadrant,
  getRotatedFootprint,
  isRotationOf,
} from "./rotateFootprint.ts";
import { Footprint } from "./types.ts";

const fp = (): Footprint => ({
  left: 0,
  top: 0,
  width: 2,
  height: 1,
  map: [1, 2],
});

describe("rotateFootprint", () => {
  it("identity rotation returns the original reference", () => {
    const f = fp();
    expect(getRotatedFootprint(f, 0)).toBe(f);
  });

  it("rotates 90 CCW", () => {
    const r = getRotatedFootprint(fp(), 1);
    expect(r.left).toBe(-1);
    expect(r.top).toBe(0);
    expect(r.width).toBe(1);
    expect(r.height).toBe(2);
    expect(r.map).toEqual([1, 2]);
  });

  it("rotates 180", () => {
    const r = getRotatedFootprint(fp(), 2);
    expect(r.left).toBe(-2);
    expect(r.top).toBe(-1);
    expect(r.width).toBe(2);
    expect(r.height).toBe(1);
    expect(r.map).toEqual([2, 1]);
  });

  it("rotates 270 CCW", () => {
    const r = getRotatedFootprint(fp(), 3);
    expect(r.left).toBe(0);
    expect(r.top).toBe(-2);
    expect(r.width).toBe(1);
    expect(r.height).toBe(2);
    expect(r.map).toEqual([2, 1]);
  });

  it("memoizes per (original, quadrant)", () => {
    const f = fp();
    expect(getRotatedFootprint(f, 1)).toBe(getRotatedFootprint(f, 1));
    expect(getRotatedFootprint(f, 2)).toBe(getRotatedFootprint(f, 2));
  });

  it("preserves square non-trivial maps", () => {
    const f: Footprint = {
      left: 0,
      top: 0,
      width: 2,
      height: 2,
      map: [1, 2, 3, 4],
    };
    expect(getRotatedFootprint(f, 1).map).toEqual([3, 1, 4, 2]);
    expect(getRotatedFootprint(f, 2).map).toEqual([4, 3, 2, 1]);
    expect(getRotatedFootprint(f, 3).map).toEqual([2, 4, 1, 3]);
  });

  it("facingToQuadrant snaps to the nearest 90 degrees", () => {
    expect(facingToQuadrant(0)).toBe(0);
    expect(facingToQuadrant(Math.PI / 2)).toBe(1);
    expect(facingToQuadrant(Math.PI)).toBe(2);
    expect(facingToQuadrant(-Math.PI / 2)).toBe(3);
    expect(facingToQuadrant(-Math.PI)).toBe(2);
    expect(facingToQuadrant(-3 * Math.PI / 2)).toBe(1);
    expect(facingToQuadrant(-2 * Math.PI)).toBe(0);
    expect(facingToQuadrant(Math.PI / 2 + 0.1)).toBe(1);
    expect(facingToQuadrant(-Math.PI / 2 - 0.1)).toBe(3);
    expect(facingToQuadrant(undefined)).toBe(0);
  });

  it("isRotationOf recognizes cached outputs", () => {
    const f = fp();
    const r = getRotatedFootprint(f, 1);
    expect(isRotationOf(r, f)).toBe(true);
    expect(isRotationOf(f, f)).toBe(true);
    expect(isRotationOf({ ...f }, f)).toBe(false);
  });
});
