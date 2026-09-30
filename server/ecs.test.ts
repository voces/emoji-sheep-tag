import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { makeLoopGuard } from "./ecs.ts";

const countWarnings = (fn: () => void) => {
  const original = console.warn;
  let warnings = 0;
  console.warn = () => warnings++;
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
};

describe("makeLoopGuard", () => {
  it("warns at the threshold and then once every threshold iterations", () => {
    const guard = makeLoopGuard("test", 10, 1000);
    expect(countWarnings(() => {
      for (let i = 0; i < 9; i++) guard();
    })).toBe(0);
    expect(countWarnings(guard)).toBe(1);
    expect(countWarnings(() => {
      for (let i = 0; i < 9; i++) guard();
    })).toBe(0);
    expect(countWarnings(guard)).toBe(1);
    expect(countWarnings(() => {
      for (let i = 0; i < 25; i++) guard();
    })).toBe(2);
  });

  it("throws once the throw threshold is reached", () => {
    const guard = makeLoopGuard("test", 1000, 5);
    for (let i = 0; i < 4; i++) guard();
    const original = console.error;
    console.error = () => {};
    try {
      expect(guard).toThrow("[loop-infinite] test exceeded 5 iterations");
    } finally {
      console.error = original;
    }
  });
});
