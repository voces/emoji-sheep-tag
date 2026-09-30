import { expect } from "@std/expect";
import { ExtendedSet } from "./ExtendedSet.ts";

Deno.test("seeded values do not dispatch and listeners still attach", () => {
  const set = new ExtendedSet([1, 2]);
  const added: number[] = [];
  set.addEventListener("add", (v) => added.push(v));
  set.add(3);
  expect(added).toEqual([3]);
  expect(set.map((v) => v * 2)).toEqual([2, 4, 6]);
});

Deno.test("delete dispatches only when the value was present", () => {
  const set = new ExtendedSet([1]);
  const deleted: number[] = [];
  set.addEventListener("delete", (v) => deleted.push(v));
  set.delete(2);
  set.delete(1);
  expect(deleted).toEqual([1]);
});

Deno.test("unsubscribing stops only that listener", () => {
  const set = new ExtendedSet<number>();
  const a: number[] = [];
  const b: number[] = [];
  const clearA = set.addEventListener("add", (v) => a.push(v));
  set.addEventListener("add", (v) => b.push(v));
  set.add(1);
  clearA();
  clearA();
  set.add(2);
  expect(a).toEqual([1]);
  expect(b).toEqual([1, 2]);
});

Deno.test("predicates receive only the value", () => {
  const set = new ExtendedSet([5]);
  const arities: number[] = [];
  const record = (...args: unknown[]) => arities.push(args.length) > 0;
  set.some(record);
  set.every(record);
  set.find(record);
  set.map(record);
  expect(arities).toEqual([1, 1, 1, 1]);
});
