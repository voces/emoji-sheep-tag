import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { BinaryHeap } from "./BinaryHeap.ts";

type Node = { name: string; score: number };

const heapOf = (scores: number[]) => {
  const heap = new BinaryHeap<Node>((n) => n.score);
  const nodes = scores.map((score, i) => ({ name: `n${i}`, score }));
  for (const node of nodes) heap.push(node);
  return { heap, nodes };
};

it("pops a buried element first once its score is decreased below the rest", () => {
  const { heap, nodes } = heapOf([1, 2, 3, 4, 5, 6, 7]);
  const buried = nodes[6];
  buried.score = 0;
  heap.decrease(buried);

  expect(heap.pop()).toBe(buried);
  expect(heap.pop().score).toBe(1);
});

it("keeps heap order after decreasing an element partway up", () => {
  const { heap, nodes } = heapOf([10, 20, 30, 40, 50, 60, 70, 80]);
  nodes[7].score = 25;
  heap.decrease(nodes[7]);

  const popped: number[] = [];
  while (heap.length) popped.push(heap.pop().score);
  expect(popped).toEqual([10, 20, 25, 30, 40, 50, 60, 70]);
});

it("ignores decrease for an element not in the heap", () => {
  const { heap } = heapOf([3, 1, 2]);
  heap.decrease({ name: "stranger", score: -1 });

  expect(heap.length).toBe(3);
  expect(heap.pop().score).toBe(1);
});
