import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { AREA_PER_BIRD, birdLimit } from "./birds.ts";

const bounds = (w: number, h: number) => ({
  min: { x: 0, y: 0 },
  max: { x: w, y: h },
});

describe("bird limit", () => {
  /**
   * Birds are rolled per tree, so the count would otherwise follow how many
   * trees a map has rather than how much ground it covers.
   */
  it("follows area, not how many trees are crammed into it", () => {
    expect(birdLimit(bounds(100, 100))).toBe(10000 / AREA_PER_BIRD);
    expect(birdLimit(bounds(200, 100))).toBe(20000 / AREA_PER_BIRD);
  });

  it("leaves thinly wooded maps alone", () => {
    // revo and compact settle near 17 and 12 birds unaided, and should not be cut
    expect(birdLimit(bounds(79, 79))).toBeGreaterThan(17);
    expect(birdLimit(bounds(55, 55))).toBeGreaterThan(12);
  });

  it("caps a densely wooded map well below its tree count", () => {
    // the campaign map is 154 x 75 and would otherwise spawn well over 300
    expect(birdLimit(bounds(154, 75))).toBeLessThan(60);
  });

  it("always allows at least one bird", () => {
    expect(birdLimit(bounds(4, 4))).toBe(1);
  });
});
