import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { loadEstb } from "./loadEstb.ts";
import { loadEstbModel } from "./loadEstbModel.ts";

const float16 = (value: number): number => {
  if (value === 0) return 0;
  const bits = new Uint32Array(new Float32Array([value]).buffer)[0];
  return ((bits >>> 16) & 0x8000) | ((((bits >>> 23) & 0xff) - 112) << 10) |
    ((bits >>> 13) & 0x3ff);
};

type Segment = readonly [p0: Pt, c0: Pt, c1: Pt, p1: Pt];
type Pt = readonly [number, number];

/** An estb file of one path along `segments`, with no animation at all. */
const estbOf = (
  segments: readonly Segment[],
  { anchorColors, playerMask }: {
    anchorColors?: number[];
    playerMask?: boolean;
  } = {},
): ArrayBuffer => {
  const bytes: number[] = [];
  const u8 = (v: number) => bytes.push(v & 0xff);
  const u16 = (v: number) => {
    u8(v);
    u8(v >> 8);
  };
  const u24 = (v: number) => {
    u16(v);
    u8(v >> 16);
  };
  const f16 = (v: number) => u16(float16(v));

  for (const c of "EST") u8(c.charCodeAt(0));
  u8(4);
  u16(1);
  u16(0);
  u16(0);
  u16(0);

  u8((playerMask ? 1 : 0) | (anchorColors ? 8 : 0));
  u24(0x808080);
  u8(255);
  u16(segments.length);
  for (const segment of segments) {
    for (const [x, y] of segment) {
      f16(x);
      f16(y);
    }
  }
  for (const colour of anchorColors ?? []) u24(colour);

  return new Uint8Array(bytes).buffer;
};

const CORNERS: Pt[] = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

/**
 * A square of four straight segments, one colour per corner: the smallest file
 * that carries a gradient.
 */
const staticSquare = (options?: Parameters<typeof estbOf>[1]) =>
  estbOf(
    CORNERS.map(([x, y], index): Segment => {
      const [nx, ny] = CORNERS[(index + 1) % CORNERS.length];
      return [
        [x, y],
        [x + (nx - x) / 3, y + (ny - y) / 3],
        [x + (nx - x) * 2 / 3, y + (ny - y) * 2 / 3],
        [nx, ny],
      ];
    }),
    options,
  );

/** A circle of radius 10 in four cubic arcs. */
const circle = () => {
  const k = 10 * 0.5522847498;
  return estbOf([
    [[10, 0], [10, k], [k, 10], [0, 10]],
    [[0, 10], [-k, 10], [-10, k], [-10, 0]],
    [[-10, 0], [-10, -k], [-k, -10], [0, -10]],
    [[0, -10], [k, -10], [10, -k], [10, 0]],
  ]);
};

/** The area a geometry's triangles cover. */
const areaOf = (geometry: { getAttribute: (n: string) => unknown }) => {
  const { array } = geometry.getAttribute("position") as {
    array: ArrayLike<number>;
  };
  let area = 0;
  for (let i = 0; i < array.length; i += 9) {
    area += Math.abs(
      (array[i + 3] - array[i]) * (array[i + 7] - array[i + 1]) -
        (array[i + 6] - array[i]) * (array[i + 4] - array[i + 1]),
    ) / 2;
  }
  return area;
};

const distinctColors = (geometry: { getAttribute: (n: string) => unknown }) => {
  const color = geometry.getAttribute("color") as {
    count: number;
    getX: (i: number) => number;
    getY: (i: number) => number;
    getZ: (i: number) => number;
  };
  return new Set(
    Array.from(
      { length: color.count },
      (_, i) => `${color.getX(i)},${color.getY(i)},${color.getZ(i)}`,
    ),
  );
};

describe("loadEstb", () => {
  it("draws a straight-edged shape as its corners alone", () => {
    const { geometry } = loadEstb(staticSquare(), { scale: 0.01 });
    expect(geometry.getAttribute("position").count).toBe(6);
  });

  it("follows a curve closely in few points", () => {
    const scale = 0.01;
    const { geometry } = loadEstb(circle(), { scale });
    const truth = Math.PI * (10 * scale) ** 2;
    expect(Math.abs(areaOf(geometry) - truth) / truth).toBeLessThan(0.005);
    // Four arcs of 32 steps apiece triangulate to 126 triangles
    expect(geometry.getAttribute("position").count).toBeLessThan(126 * 3 / 2);
  });

  it("loads a model that carries no animation, leaving it in the default pose", () => {
    const { animationData } = loadEstb(staticSquare());
    expect(animationData.clipCount).toBe(1);
    expect(animationData.sampleCount).toBeGreaterThan(0);
    expect(animationData.clips.get("default")).toEqual({
      index: 0,
      duration: 0,
    });
  });

  it("lerps between anchor colours, which one flat fill cannot express", () => {
    const flat = loadEstb(staticSquare());
    const graded = loadEstb(
      staticSquare({ anchorColors: [0x400000, 0x800000, 0xc00000, 0xff0000] }),
    );
    expect(distinctColors(flat.geometry).size).toBe(1);
    expect(distinctColors(graded.geometry).size).toBeGreaterThan(4);
  });

  it("keeps the player flag on a graded path, so the accent still takes the player's colour", () => {
    const { geometry } = loadEstb(
      staticSquare({
        anchorColors: [0x400000, 0x800000, 0xc00000, 0xff0000],
        playerMask: true,
      }),
    );
    const mask = geometry.getAttribute("playerMask");
    expect(mask.count).toBeGreaterThan(0);
    for (let i = 0; i < mask.count; i++) expect(mask.getX(i)).toBe(1);
  });

  it("builds a mesh from a model with no clips", () => {
    const mesh = loadEstbModel(staticSquare(), "staticSquare", { zOrder: 0 });
    expect(mesh.getClipInfo("default")).toBeDefined();
    expect(mesh.getClipInfo("walk")).toBeUndefined();
  });
});
