import { Footprint } from "./types.ts";

export type Quadrant = 0 | 1 | 2 | 3;

const cache = new WeakMap<
  Footprint,
  [Footprint, Footprint, Footprint, Footprint]
>();

export const facingToQuadrant = (facing: number | null | undefined): Quadrant =>
  ((Math.round((facing ?? 0) / (Math.PI / 2)) % 4) + 4) % 4 as Quadrant;

const rotate90CCW = (f: Footprint): Footprint => {
  const map = new Array<number>(f.map.length);
  for (let ty = 0; ty < f.width; ty++) {
    for (let tx = 0; tx < f.height; tx++) {
      map[ty * f.height + tx] = f.map[(f.height - 1 - tx) * f.width + ty];
    }
  }
  return {
    left: -f.top - f.height,
    top: f.left,
    width: f.height,
    height: f.width,
    map,
  };
};

const rotate180 = (f: Footprint): Footprint => {
  const map = new Array<number>(f.map.length);
  for (let ty = 0; ty < f.height; ty++) {
    for (let tx = 0; tx < f.width; tx++) {
      map[ty * f.width + tx] =
        f.map[(f.height - 1 - ty) * f.width + (f.width - 1 - tx)];
    }
  }
  return {
    left: -f.left - f.width,
    top: -f.top - f.height,
    width: f.width,
    height: f.height,
    map,
  };
};

const rotate270CCW = (f: Footprint): Footprint => {
  const map = new Array<number>(f.map.length);
  for (let ty = 0; ty < f.width; ty++) {
    for (let tx = 0; tx < f.height; tx++) {
      map[ty * f.height + tx] = f.map[tx * f.width + (f.width - 1 - ty)];
    }
  }
  return {
    left: f.top,
    top: -f.left - f.width,
    width: f.height,
    height: f.width,
    map,
  };
};

export const getRotatedFootprint = (
  original: Footprint,
  quadrant: Quadrant,
): Footprint => {
  let entry = cache.get(original);
  if (!entry) {
    entry = [
      original,
      rotate90CCW(original),
      rotate180(original),
      rotate270CCW(original),
    ];
    cache.set(original, entry);
  }
  return entry[quadrant];
};

export const isRotationOf = (
  candidate: Footprint,
  original: Footprint,
): boolean => {
  const entry = cache.get(original);
  if (!entry) return candidate === original;
  return entry.includes(candidate);
};
