import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Buff, Entity } from "@/shared/types.ts";
import { cleanupTest, createTestSetup } from "@/server-testing/setup.ts";
import "./buffs.ts"; // Import to register the system

afterEach(cleanupTest);

describe("buffs system", () => {
  it("should reduce buff duration over time", () => {
    const { ecs } = createTestSetup();

    const buff: Buff = {
      remainingDuration: 10,
      attackSpeedMultiplier: 1.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(2); // Advance 2 seconds

    expect(entity.buffs).toBeDefined();
    expect(entity.buffs![0].remainingDuration).toBe(8);
  });

  it("should remove expired buffs", () => {
    const { ecs } = createTestSetup();

    const buff: Buff = {
      remainingDuration: 2,
      movementSpeedBonus: 0.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(3); // Advance 3 seconds (buff expires at 2)

    expect(entity.buffs).toBeFalsy();
  });

  it("should handle multiple buffs with different durations", () => {
    const { ecs } = createTestSetup();

    const buff1: Buff = {
      remainingDuration: 5,
      attackSpeedMultiplier: 1.2,
    };

    const buff2: Buff = {
      remainingDuration: 10,
      movementSpeedBonus: 0.3,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff1, buff2],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(6); // Advance 6 seconds

    // buff1 should be expired, buff2 should remain
    expect(entity.buffs).toBeDefined();
    expect(entity.buffs!.length).toBe(1);
    expect(entity.buffs![0].remainingDuration).toBe(4);
  });

  it("should preserve buffs immutability", () => {
    const { ecs } = createTestSetup();

    const originalBuff: Buff = {
      remainingDuration: 10,
      attackSpeedMultiplier: 1.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [originalBuff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(2);

    // Original buff should be unchanged
    expect(originalBuff.remainingDuration).toBe(10);
    // Entity's buff should be updated
    expect(entity.buffs![0].remainingDuration).toBe(8);
    // Should be a different object
    expect(entity.buffs![0]).not.toBe(originalBuff);
  });

  it("should delete buffs property when all buffs expire", () => {
    const { ecs } = createTestSetup();

    const buff1: Buff = {
      remainingDuration: 2,
      attackSpeedMultiplier: 1.1,
    };

    const buff2: Buff = {
      remainingDuration: 3,
      movementSpeedBonus: 0.2,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff1, buff2],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(4); // All buffs expire

    expect(entity.buffs).toBeFalsy();
  });

  it("should handle fractional time updates", () => {
    const { ecs } = createTestSetup();

    const buff: Buff = {
      remainingDuration: 5.5,
      attackSpeedMultiplier: 1.15,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(0.3);
    ecs.update(0.2);
    ecs.update(0.5);

    expect(entity.buffs![0].remainingDuration).toBeCloseTo(4.5);
  });

  it("should handle movement speed multiplier buffs", () => {
    const { ecs } = createTestSetup();

    const buff: Buff = {
      remainingDuration: 10,
      movementSpeedMultiplier: 1.15,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(3); // Advance 3 seconds

    expect(entity.buffs).toBeDefined();
    expect(entity.buffs![0].remainingDuration).toBe(7);
    expect(entity.buffs![0].movementSpeedMultiplier).toBe(1.15);
  });
});
