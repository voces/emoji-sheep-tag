import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { formatTargeting } from "./formatTargeting.ts";
import type { Classification } from "../data.ts";

it("single classification - other", () => {
  const targeting: Classification[][] = [["other"]];
  expect(formatTargeting(targeting)).toBe("Must target another");
});

it("single classification - structure", () => {
  const targeting: Classification[][] = [["structure"]];
  expect(formatTargeting(targeting)).toBe("Must target a structure");
});

it("OR within same group - structure or tree", () => {
  const targeting: Classification[][] = [["structure", "tree"]];
  expect(formatTargeting(targeting)).toBe("Must target a structure or tree");
});

it("OR within same group - unit or ward", () => {
  const targeting: Classification[][] = [["unit", "ward"]];
  expect(formatTargeting(targeting)).toBe("Must target a unit or ward");
});

it("AND across groups - ally unit", () => {
  const targeting: Classification[][] = [["ally", "unit"]];
  expect(formatTargeting(targeting)).toBe("Must target an ally unit");
});

it("multiple top-level groups with OR - spirit, ward, or structure", () => {
  const targeting: Classification[][] = [["spirit"], ["ward"], ["structure"]];
  expect(formatTargeting(targeting)).toBe(
    "Must target a spirit, a ward, or a structure",
  );
});

it("empty targeting returns invalid target", () => {
  expect(formatTargeting([])).toBe("Invalid target");
});

it("ally or neutral - same alliance group", () => {
  const targeting: Classification[][] = [["ally", "neutral"]];
  expect(formatTargeting(targeting)).toBe("Must target an ally or neutral");
});

it("enemy structure - cross-group AND", () => {
  const targeting: Classification[][] = [["enemy", "structure"]];
  expect(formatTargeting(targeting)).toBe("Must target an enemy structure");
});

it("self unit - self targeting", () => {
  const targeting: Classification[][] = [["self", "unit"]];
  expect(formatTargeting(targeting)).toBe("Must target a self unit");
});

it("non-spirit ward - spirit group with destructible", () => {
  const targeting: Classification[][] = [["notSpirit", "ward"]];
  expect(formatTargeting(targeting)).toBe("Must target a non-spirit ward");
});

it("complex - ally or enemy, unit or structure", () => {
  const targeting: Classification[][] = [[
    "ally",
    "enemy",
    "unit",
    "structure",
  ]];
  expect(formatTargeting(targeting)).toBe(
    "Must target an ally or enemy unit or structure",
  );
});

it("multiple alternatives with complex groups", () => {
  const targeting: Classification[][] = [
    ["ally", "unit"],
    ["enemy", "structure"],
  ];
  expect(formatTargeting(targeting)).toBe(
    "Must target an ally unit or an enemy structure",
  );
});
