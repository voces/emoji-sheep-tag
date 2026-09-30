import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { groupBy } from "./groupBy.ts";

it("groups items by key in first-seen order, keeping each group's order", () => {
  const groups = groupBy(["ant", "bee", "asp", "cat", "bat"], (w) => w[0]);
  expect([...groups]).toEqual([
    ["a", ["ant", "asp"]],
    ["b", ["bee", "bat"]],
    ["c", ["cat"]],
  ]);
});
