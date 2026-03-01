import { expect } from "@std/expect";
import { KdTree } from "./KDTree.ts";

type PointTreeNode = {
  x: number;
  y: number;
  left?: PointTreeNode;
  right?: PointTreeNode;
};

const toPointTree = (node: KdTree["root"]): PointTreeNode => {
  if (!node) throw new Error("Expected node!");
  return {
    x: node.point.x,
    y: node.point.y,
    ...(node.left ? { left: toPointTree(node.left) } : {}),
    ...(node.right ? { right: toPointTree(node.right) } : {}),
  };
};

Deno.test("add and delete root", () => {
  const kd = new KdTree();
  const p = { x: 0, y: 0 };
  kd.add(p);

  expect(toPointTree(kd.root)).toEqual({ x: 0, y: 0 });

  kd.delete(p);

  expect(kd.root).toEqual(null);
});

Deno.test("add three levels and delete mid level (repeat)", () => {
  const kd = new KdTree();
  const p = { x: -1, y: 0 };
  kd.add({ x: 0, y: 0 });
  kd.add(p);
  kd.add({ x: -1, y: -1 });
  kd.add({ x: -1, y: 1 });
  kd.add({ x: 1, y: 0 });
  kd.add({ x: 1, y: -1 });
  kd.add({ x: 1, y: 1 });

  expect(toPointTree(kd.root)).toEqual({
    x: 0,
    y: 0,
    left: { x: -1, y: 0, left: { x: -1, y: -1 }, right: { x: -1, y: 1 } },
    right: { x: 1, y: 0, left: { x: 1, y: -1 }, right: { x: 1, y: 1 } },
  });

  kd.delete(p);

  expect(toPointTree(kd.root)).toEqual({
    x: 0,
    y: 0,
    left: { x: -1, y: 1, left: { x: -1, y: -1 } },
    right: { x: 1, y: 0, left: { x: 1, y: -1 }, right: { x: 1, y: 1 } },
  });

  kd.add(p);

  expect(toPointTree(kd.root)).toEqual({
    x: 0,
    y: 0,
    left: { x: -1, y: 1, left: { x: -1, y: -1, right: { x: -1, y: 0 } } },
    right: { x: 1, y: 0, left: { x: 1, y: -1 }, right: { x: 1, y: 1 } },
  });

  kd.delete(p);

  expect(toPointTree(kd.root)).toEqual({
    x: 0,
    y: 0,
    left: { x: -1, y: 1, left: { x: -1, y: -1 } },
    right: { x: 1, y: 0, left: { x: 1, y: -1 }, right: { x: 1, y: 1 } },
  });

  kd.add(p);

  expect(toPointTree(kd.root)).toEqual({
    x: 0,
    y: 0,
    left: { x: -1, y: 1, left: { x: -1, y: -1, right: { x: -1, y: 0 } } },
    right: { x: 1, y: 0, left: { x: 1, y: -1 }, right: { x: 1, y: 1 } },
  });
});

Deno.test("nearest returns closest point matching filter", () => {
  const kd = new KdTree();
  const a = { x: 1, y: 1 };
  const b = { x: 3, y: 3 };
  const c = { x: 5, y: 5 };
  kd.add(a);
  kd.add(b);
  kd.add(c);

  expect(kd.nearest(0, 0, () => true)).toBe(a);
  expect(kd.nearest(4, 4, () => true)).toBe(b);
  expect(kd.nearest(0, 0, (p) => p !== a)).toBe(b);
  expect(kd.nearest(0, 0, () => false)).toBe(null);
});

Deno.test("kNearest returns k closest points in order", () => {
  const kd = new KdTree();
  const points = [
    { x: 10, y: 0 },
    { x: 1, y: 0 },
    { x: 5, y: 0 },
    { x: 3, y: 0 },
    { x: 7, y: 0 },
  ];
  for (const p of points) kd.add(p);

  const result = kd.kNearest(0, 0, 3, () => true);
  expect(result).toEqual([
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 5, y: 0 },
  ]);
});

Deno.test("kNearest with filter skips non-matching points", () => {
  const kd = new KdTree();
  const a = { x: 1, y: 0 };
  const b = { x: 2, y: 0 };
  const c = { x: 3, y: 0 };
  const d = { x: 4, y: 0 };
  kd.add(a);
  kd.add(b);
  kd.add(c);
  kd.add(d);

  const result = kd.kNearest(0, 0, 2, (p) => p.x % 2 === 0);
  expect(result).toEqual([b, d]);
});

Deno.test("kNearest returns fewer than k when not enough points match", () => {
  const kd = new KdTree();
  kd.add({ x: 1, y: 0 });
  kd.add({ x: 2, y: 0 });

  expect(kd.kNearest(0, 0, 5, () => true)).toHaveLength(2);
  expect(kd.kNearest(0, 0, 3, () => false)).toEqual([]);
});
