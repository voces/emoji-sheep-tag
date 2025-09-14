import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { addItem, newUnit } from "../../api/unit.ts";
import { advanceCast } from "./advanceCast.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { mirrorImageOrder } from "../../orders/mirrorImage.ts";
import { nonNull } from "@/shared/types.ts";

afterEach(cleanupTest);

describe("advanceCast mirror image", () => {
  it("should clear existing mirrors when starting a new cast", {
    wolves: ["test-client"],
  }, function* ({ ecs }) {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100; // Ensure it has plenty of mana
    yield;

    // First cast - create initial mirror using new order system
    mirrorImageOrder.onIssue(wolf, undefined, false);
    advanceCast(wolf, 1.0); // Complete the cast
    yield;

    // Verify mirror were created
    expect(wolf.mirrors).toBeDefined();
    expect(wolf.mirrors).toHaveLength(1);
    const firstMirrors = Array.from(ecs.entities).filter((e) => e.isMirror);
    expect(firstMirrors).toHaveLength(1);
    const firstMirrorIds = firstMirrors.map((m) => m.id);

    // Second cast - should clear existing mirror and create new ones
    mirrorImageOrder.onIssue(wolf, undefined, false); // This initiates the cast order
    yield;

    // Advance cast slightly to trigger cast start (which clears old mirror)
    advanceCast(wolf, 0.1);
    yield;

    // Old mirror should be removed from ECS entirely
    const mirrorsInEcs = Array.from(ecs.entities).filter((e) =>
      firstMirrorIds.includes(e.id)
    );
    expect(mirrorsInEcs).toHaveLength(0);

    // Wolf's mirror should be cleared (will be recreated when cast completes)
    expect(wolf.mirrors).toBeFalsy();

    // Complete the second cast (remaining time after the 0.1s start)
    advanceCast(wolf, 0.9);
    yield;

    // New mirror should be created
    expect(wolf.mirrors).toBeDefined();
    expect(wolf.mirrors).toHaveLength(1);

    // Verify new mirror are different from old ones
    const newMirrors = Array.from(ecs.entities).filter((e) => e.isMirror);
    expect(newMirrors).toHaveLength(1);
    const newMirrorIds = newMirrors.map((m) => m.id);

    // New mirror IDs should be different from old ones
    expect(newMirrorIds.some((id) => firstMirrorIds.includes(id))).toBe(false);

    // Verify old mirror are completely gone from ECS
    const allEntitiesWithOldIds = Array.from(ecs.entities).filter((e) =>
      firstMirrorIds.includes(e.id)
    );
    expect(allEntitiesWithOldIds).toHaveLength(0);
  });

  it("should consume mana when mirror image cast starts", {
    wolves: ["test-client"],
  }, function* () {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    wolf.maxMana = 100;

    // Set a mirror image cast order
    wolf.order = { type: "cast", orderId: "mirrorImage", remaining: 1.0 };
    yield;

    // Call advanceCast which should consume mana when the cast starts
    advanceCast(wolf, 0.1);
    yield;

    // Mana should be consumed (mirror image costs 20 mana, 0.05 mana regen)
    expect(wolf.mana).toBe(80.05);

    // Order should be marked as started
    expect(
      (wolf.order as { type: string; orderId: string; started?: boolean })
        ?.started,
    ).toBe(true);

    // Advancing cast further should not consume more mana
    advanceCast(wolf, 0.1);
    yield;
    expect(wolf.mana).toBe(80.1);
  });

  it("should handle partial cast time correctly", {
    wolves: ["test-client"],
  }, function* () {
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Set a mirror image cast order
    wolf.order = { type: "cast", orderId: "mirrorImage", remaining: 1.0 };
    yield;

    // Advance cast by 0.3 seconds
    const leftover = advanceCast(wolf, 0.3);
    yield;

    // Should consume all delta
    expect(leftover).toBe(0);

    // Order should still exist with reduced time
    expect(
      (wolf.order as { type: string; orderId: string; remaining: number })
        ?.remaining,
    ).toBeCloseTo(0.6, 1);
  });

  it("should create new mirrors after cast completes", {
    wolves: ["test-client"],
  }, function* ({ ecs }) {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 50;

    // Set a mirror image cast order with short duration
    wolf.order = { type: "cast", orderId: "mirrorImage", remaining: 0.5 };
    yield;

    // Complete the cast
    advanceCast(wolf, 0.5);
    yield;

    // Order should be cleared
    expect(wolf.order).toBeFalsy();

    // New mirrors should be created
    expect(wolf.mirrors).toHaveLength(1);

    // Verify mirror entities exist
    const mirrors = Array.from(ecs.entities).filter((e) => e.isMirror);
    expect(mirrors).toHaveLength(1);

    const positions = [wolf.position, ...mirrors.map((m) => m.position)].filter(
      nonNull,
    ).sort((a, b) => a.y - b.y);
    expect(positions).toEqual([{ x: 5, y: 3.75 }, { x: 5, y: 6.25 }]);

    // Mirrors should copy health and mana from original (after mana cost deduction)
    // Wolf had 50 mana, mirrorImage costs 20, so 30 mana remains
    mirrors.forEach((mirror) => {
      expect(mirror.health).toBe(wolf.health);
      expect(mirror.mana).toBeCloseTo(30.1, 1);
    });
  });
});

describe("advanceCast other abilities", () => {
  it("should spawn fox after cast completes", {
    wolves: ["test-client"],
  }, function* ({ ecs }) {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "foxToken");
    wolf.facing = 0; // Facing right

    // Set a fox cast order
    wolf.order = {
      type: "cast",
      orderId: "fox",
      remaining: 0.3,
    };
    yield;

    // Complete the cast
    advanceCast(wolf, 0.3);
    yield;

    // Order should be cleared
    expect(wolf.order).toBeFalsy();

    // Fox should be spawned
    const foxes = Array.from(ecs.entities).filter((e) => e.prefab === "fox");
    expect(foxes).toHaveLength(1);

    // Fox should be spawned in front of the wolf
    expect(foxes[0].position!.x).toBeCloseTo(6, 0.1);
    expect(foxes[0].position!.y).toBeCloseTo(5, 0.1);
  });

  // Note: destroyLastFarm is now an instant action that doesn't use advanceCast
  // It's tested in the unitOrder.test.ts file instead

  it("should handle unknown cast orderId gracefully", {
    wolves: ["test-client"],
  }, function* () {
    const unit = newUnit("test-client", "wolf", 5, 5);

    // Set an unknown cast order
    unit.order = {
      type: "cast",
      orderId: "unknownAbility",
      remaining: 0.1,
    };
    yield;

    // Should not throw, just warn
    expect(() => advanceCast(unit, 0.1)).not.toThrow();
    yield;

    // Order should be cleared after completion
    expect(unit.order).toBeFalsy();
  });

  it("should handle partial time advancement correctly", {
    wolves: ["test-client"],
  }, function* () {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "foxToken");

    // Set a cast order with 1 second duration
    wolf.order = { type: "cast", orderId: "fox", remaining: 1.0 };
    yield;

    // Advance by 0.3 seconds
    const leftover = advanceCast(wolf, 0.3);
    yield;

    // Should consume all delta time
    expect(leftover).toBe(0);

    // Order should still exist with reduced remaining time
    expect(
      (wolf.order as { type: string; orderId: string; remaining: number })
        ?.remaining,
    ).toBeCloseTo(0.6, 1); // 0.1 from two yields and 0.3 from manual advanceCast

    // Advance by 0.8 seconds (more than remaining)
    const leftover2 = advanceCast(wolf, 0.8);
    yield;

    // Should return leftover time
    expect(leftover2).toBeCloseTo(0.2, 1);

    // Order should be completed and cleared
    expect(wolf.order).toBeFalsy();
  });
});
