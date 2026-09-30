import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Box3, Ray, Vector3 } from "three";
import { BVH } from "./BVH.ts";

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const boxAt = (x: number, y: number, size = 1) =>
  new Box3(new Vector3(x, y, -0.5), new Vector3(x + size, y + size, 0.5));

const downAt = (x: number, y: number) =>
  new Ray(new Vector3(x, y, 10), new Vector3(0, 0, -1));

const hits = (bvh: BVH, ray: Ray) => bvh.raycast(ray).sort((a, b) => a - b);

const bruteForce = (boxes: Map<number, Box3>, ray: Ray) =>
  [...boxes].filter(([, box]) => ray.intersectsBox(box)).map(([i]) => i)
    .sort((a, b) => a - b);

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

it("finds exactly the boxes a ray crosses through adds, moves and removals", () => {
  const next = random(1);
  const bvh = new BVH();
  const boxes = new Map<number, Box3>();

  for (let step = 0; step < 2000; step++) {
    const index = Math.floor(next() * 200);
    if (next() < 0.25) {
      bvh.removeInstance(index);
      boxes.delete(index);
    } else {
      const box = boxAt(next() * 100, next() * 100, 0.5 + next() * 3);
      bvh.addOrUpdateInstance(index, box);
      boxes.set(index, box);
    }
    if (step % 50 === 0) {
      for (let r = 0; r < 20; r++) {
        const ray = downAt(next() * 100, next() * 100);
        expect(hits(bvh, ray)).toEqual(bruteForce(boxes, ray));
      }
    }
  }
});

it("applies queued updates, whether it inserts them one by one or rebuilds", async () => {
  const next = random(2);
  const boxes = new Map<number, Box3>();
  const bvh = new BVH();
  bvh.setGetBoundingBox((index) => boxes.get(index) ?? null);

  const queue = (index: number, box: Box3 | null) => {
    if (box) boxes.set(index, box);
    else boxes.delete(index);
    bvh.queueUpdate(index, box);
  };

  const check = () => {
    for (let r = 0; r < 100; r++) {
      const ray = downAt(next() * 100, next() * 100);
      expect(hits(bvh, ray)).toEqual(bruteForce(boxes, ray));
    }
  };

  for (let i = 0; i < 300; i++) queue(i, boxAt(next() * 100, next() * 100, 2));
  await flush();
  check();

  for (let i = 0; i < 10; i++) {
    queue(Math.floor(next() * 300), boxAt(next() * 100, next() * 100, 2));
  }
  await flush();
  check();

  for (let i = 0; i < 300; i += 2) queue(i, null);
  await flush();
  check();

  for (let i = 0; i < 120; i++) {
    queue(Math.floor(next() * 400), boxAt(next() * 100, next() * 100, 2));
  }
  await flush();
  check();
});

it("keeps what it was handed even when the caller reuses the box", async () => {
  const bvh = new BVH();
  const shared = new Box3();
  bvh.setGetBoundingBox(() => null);

  bvh.queueUpdate(0, shared.copy(boxAt(0, 0)));
  bvh.queueUpdate(1, shared.copy(boxAt(50, 50)));
  await flush();

  expect(hits(bvh, downAt(0.5, 0.5))).toEqual([0]);
  expect(hits(bvh, downAt(50.5, 50.5))).toEqual([1]);
});
