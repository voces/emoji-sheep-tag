import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { computeUnitMovementSpeed } from "./unit.ts";
import { Entity } from "../types.ts";

describe("computeUnitMovementSpeed", () => {
  it("should return base movement speed for unit with no items", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 3.0,
    };

    expect(computeUnitMovementSpeed(unit)).toBe(3.0);
  });

  it("should return 0 for unit with no movement speed", () => {
    const unit: Entity = {
      id: "test-unit",
    };

    expect(computeUnitMovementSpeed(unit)).toBe(0);
  });

  it("should add movement speed bonus from single item", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 3.0,
      inventory: [{
        id: "boots",
        name: "Boots +30",
        gold: 50,
        binding: ["KeyB"],
        movementSpeedBonus: 0.3,
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBe(3.3);
  });

  it("should add movement speed bonuses from multiple items", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 3.0,
      inventory: [{
        id: "boots1",
        name: "Boots +30",
        gold: 50,
        binding: ["KeyB"],
        movementSpeedBonus: 0.3,
      }, {
        id: "boots2",
        name: "Fast Boots +20",
        gold: 40,
        binding: ["KeyF"],
        movementSpeedBonus: 0.2,
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBe(3.5);
  });

  it("should ignore items without movement speed bonus", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 3.0,
      inventory: [{
        id: "claw",
        name: "Claws +20",
        gold: 60,
        binding: ["KeyC"],
        damage: 20,
      }, {
        id: "boots",
        name: "Boots +30",
        gold: 50,
        binding: ["KeyB"],
        movementSpeedBonus: 0.3,
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBe(3.3);
  });

  it("should return base speed for unit with empty inventory", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 2.5,
      inventory: [],
    };

    expect(computeUnitMovementSpeed(unit)).toBe(2.5);
  });

  it("should return 0 for unit with no movement speed and no inventory", () => {
    const unit: Entity = {
      id: "test-unit",
    };

    expect(computeUnitMovementSpeed(unit)).toBe(0);
  });

  it("should handle fractional movement speed bonuses", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 3.1,
      inventory: [{
        id: "boots",
        name: "Boots +25",
        gold: 45,
        binding: ["KeyB"],
        movementSpeedBonus: 0.25,
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBeCloseTo(3.35);
  });
});
