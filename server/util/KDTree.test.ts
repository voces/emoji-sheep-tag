import { expect } from "jsr:@std/expect";
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
