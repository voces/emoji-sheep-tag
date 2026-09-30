import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { computeAnimationParams, getCurrentAnimation } from "./animation.ts";
import { Entity } from "../ecs.ts";

// The build branch never reads the collection, but the signature wants one.
const collection = { getClipInfo: () => ({ index: 0, duration: 2 }) };

describe("computeAnimationParams - build/upgrade", () => {
  it("locks the build clip frame to progress (speed 0) so it can't drift", () => {
    const e: Entity = { id: "a", completionTime: 4, progress: 0 };
    const { phase, speed } = computeAnimationParams("build", collection, e);

    // Speed 0 => the shader holds frame = phase, so there is no independent
    // animation clock to drift from progress.
    expect(speed).toBe(0);
    expect(phase).toBe(0);
  });

  it("maps clip phase 1:1 onto progress", () => {
    const e: Entity = { id: "a", completionTime: 4, progress: 0.5 };
    const { phase, speed } = computeAnimationParams("build", collection, e);

    expect(speed).toBe(0);
    expect(phase).toBeCloseTo(0.5, 5);
  });

  it("leaves looping animations with positive speed", () => {
    const e: Entity = { id: "a" };
    const { speed } = computeAnimationParams("idle", collection, e);

    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeCloseTo(1 / 2, 5);
  });
});

describe("getCurrentAnimation - model lookup", () => {
  const swing = {
    remaining: 1,
    source: { x: 0, y: 0 },
    target: { x: 1, y: 0 },
  };

  it("animates an entity by its model, falling back to its prefab", () => {
    expect(getCurrentAnimation({ id: "m", model: "wolf", swing })).toBe(
      "attack",
    );
    expect(getCurrentAnimation({ id: "p", prefab: "wolf", swing })).toBe(
      "attack",
    );
  });

  it("prefers the model over the prefab", () =>
    expect(
      getCurrentAnimation({ id: "t", model: "tree", prefab: "wolf", swing }),
    ).toBeUndefined());

  it("leaves svg, unknown and missing models unanimated", () => {
    expect(getCurrentAnimation({ id: "s", model: "tree", swing }))
      .toBeUndefined();
    expect(getCurrentAnimation({ id: "u", model: "nope", swing }))
      .toBeUndefined();
    expect(getCurrentAnimation({ id: "n", swing })).toBeUndefined();
  });
});
