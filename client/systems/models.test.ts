import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { collections, getModelScale } from "./models.ts";

it("keeps reporting an svg model's scale after its collection loads", () => {
  expect(getModelScale("sparkle2")).toBe(0.2);
  expect(collections.sparkle2).toBeDefined();
  expect(getModelScale("sparkle2")).toBe(0.2);
});

it("has no scale or collection for names that are not models", () => {
  expect(getModelScale("constructor")).toBeUndefined();
  expect(collections.constructor).toBeUndefined();
  expect(collections.notAModel).toBeUndefined();
});

it("serves prebuilt and lazily loaded collections, once each", () => {
  expect(collections.glow).toBe(collections.glow);
  expect(collections.wolf).toBe(collections.wolf);
  expect(getModelScale("wolf")).toBeUndefined();
});
