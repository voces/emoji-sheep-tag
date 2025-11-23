import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  computeUnitAttackSpeed,
  computeUnitDamage,
  computeUnitMovementSpeed,
  tempUnit,
} from "./unit.ts";
import { Entity } from "../types.ts";
import { items } from "../data.ts";

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
        buffs: [{ movementSpeedBonus: 0.3 }],
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
        buffs: [{ movementSpeedBonus: 0.3 }],
      }, {
        id: "boots2",
        name: "Fast Boots +20",
        gold: 40,
        binding: ["KeyF"],
        buffs: [{ movementSpeedBonus: 0.2 }],
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
        buffs: [{ damageBonus: 20 }],
      }, {
        id: "boots",
        name: "Boots +30",
        gold: 50,
        binding: ["KeyB"],
        buffs: [{ movementSpeedBonus: 0.3 }],
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
        buffs: [{ movementSpeedBonus: 0.25 }],
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBeCloseTo(3.35);
  });

  it("should apply movement speed multiplier from buffs", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 2.0,
      buffs: [{
        remainingDuration: 10,
        movementSpeedMultiplier: 1.15,
      }],
    };

    expect(computeUnitMovementSpeed(unit)).toBe(2.3);
  });

  it("should combine flat bonuses and multipliers correctly", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 2.0,
      inventory: [{
        id: "boots",
        name: "Boots",
        gold: 50,
        binding: ["KeyB"],
        buffs: [{ movementSpeedBonus: 0.3 }], // Flat bonus +0.3
      }],
      buffs: [{
        remainingDuration: 10,
        movementSpeedMultiplier: 1.15, // 15% multiplier
      }],
    };

    // 2.0 * 1.15 + 0.3 = 2.3 + 0.3 = 2.6
    expect(computeUnitMovementSpeed(unit)).toBeCloseTo(2.6);
  });

  it("should handle multiple multipliers multiplicatively", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 2.0,
      buffs: [{
        remainingDuration: 10,
        movementSpeedMultiplier: 1.15,
      }, {
        remainingDuration: 5,
        movementSpeedMultiplier: 1.1,
      }],
    };

    // 2.0 * 1.15 * 1.1 = 2.53
    expect(computeUnitMovementSpeed(unit)).toBe(2.53);
  });

  it("should combine flat bonus from buffs with multipliers", () => {
    const unit: Entity = {
      id: "test-unit",
      movementSpeed: 2.0,
      buffs: [{
        remainingDuration: 10,
        movementSpeedBonus: 0.5, // Flat +0.5
      }, {
        remainingDuration: 10,
        movementSpeedMultiplier: 1.2, // 20% multiplier
      }],
    };

    // 2.0 * 1.2 + 0.5 = 2.4 + 0.5 = 2.9
    expect(computeUnitMovementSpeed(unit)).toBe(2.9);
  });
});

describe("computeUnitDamage", () => {
  it("should return 0 for unit without attack", () => {
    const unit = tempUnit("test-owner", "sheep", 10, 10);
    expect(computeUnitDamage(unit)).toBe(0);
  });

  it("should return base damage for unit with no items", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10);
    expect(computeUnitDamage(unit)).toBe(70); // Wolf base damage
  });

  it("should add item damage bonuses", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10, {
      inventory: [items.claw],
    });
    expect(computeUnitDamage(unit)).toBe(90); // 70 + 20
  });

  it("should add multiple item damage bonuses", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10, {
      inventory: [
        items.claw,
        { ...items.claw, id: "claw2", buffs: [{ damageBonus: 15 }] }, // Second claw with different damage
      ],
    });
    expect(computeUnitDamage(unit)).toBe(105); // 70 + 20 + 15
  });

  it("should ignore items without damage property", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10, {
      inventory: [items.foxToken],
    });
    expect(computeUnitDamage(unit)).toBe(70); // Only wolf base damage
  });
});

describe("computeUnitAttackSpeed", () => {
  it("should return 1.0 for unit with no items", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10);

    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it(
    "should return 1.0 for unit with items that have no attack speed multiplier",
    () => {
      const unit = tempUnit("test-owner", "wolf", 10, 10, {
        inventory: [items.claw, items.foxToken], // Neither has attackSpeedMultiplier
      });

      expect(computeUnitAttackSpeed(unit)).toBe(1.0);
    },
  );

  it("should apply single attack speed multiplier", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10, {
      inventory: [items.swiftness], // 1.15x multiplier
    });

    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it(
    "should stack multiple attack speed multipliers multiplicatively",
    () => {
      const unit = tempUnit("test-owner", "wolf", 10, 10, {
        inventory: [
          items.swiftness, // 1.15x
          {
            ...items.swiftness,
            id: "swiftness2",
            buffs: [{ attackSpeedMultiplier: 1.2 }],
          }, // 1.2x
        ],
      });

      expect(computeUnitAttackSpeed(unit)).toBeCloseTo(1.38, 2); // 1.15 * 1.2 = 1.38
    },
  );

  it("should ignore items without attack speed multiplier", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10, {
      inventory: [
        items.swiftness, // 1.15x
        items.claw, // No attack speed multiplier
        items.foxToken, // No attack speed multiplier
      ],
    });

    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it("should return 1.0 for unit with empty inventory", () => {
    const unit = tempUnit("test-owner", "wolf", 10, 10);

    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });
});
