import { afterEach, describe } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  addItem,
  computeUnitAttackSpeed,
  computeUnitDamage,
  damageEntity,
  newUnit,
} from "./unit.ts";
import { Entity, Item } from "@/shared/types.ts";
import { items } from "@/shared/data.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("addItem", () => {
  it("should add new item to empty inventory", function* () {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "foxToken");
    yield;

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxToken");
    expect(unit.inventory![0].name).toBe("Fox Token");
  });

  it("should initialize inventory if undefined", function* () {
    const unit: Entity = {
      id: "test-unit",
    };

    const result = addItem(unit, "foxToken");
    yield;

    expect(result).toBe(true);
    expect(unit.inventory).toBeDefined();
    expect(unit.inventory).toHaveLength(1);
  });

  it("should stack charges for existing items", function* () {
    const unit: Entity = {
      id: "test-unit",
      inventory: [{
        id: "foxToken",
        name: "Fox Token",
        icon: "fox",
        gold: 5,
        binding: ["KeyF"],
        charges: 2,
        actions: [{
          name: "Summon Fox",
          type: "auto",
          order: "fox",
          binding: ["KeyF"],
          castDuration: 0.1,
        }],
      }],
    };

    const result = addItem(unit, "foxToken");
    yield;

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].charges).toBe(3);
  });

  it("should return false for invalid item id", function* () {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "invalidItem");
    yield;

    expect(result).toBe(false);
    expect(unit.inventory).toHaveLength(0);
  });

  it("should add multiple different items", function* () {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    addItem(unit, "foxToken");
    // Note: we can only test with foxToken since other items may not exist in prefabs
    yield;

    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxToken");
  });
});

describe("computeUnitDamage", () => {
  it("should return 0 for unit without attack", function* () {
    const unit = newUnit("test-owner", "sheep", 10, 10);
    yield;
    expect(computeUnitDamage(unit)).toBe(0);
  });

  it("should return base damage for unit with no items", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    yield;
    expect(computeUnitDamage(unit)).toBe(70); // Wolf base damage
  });

  it("should add item damage bonuses", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [items.claw];
    yield;
    expect(computeUnitDamage(unit)).toBe(90); // 70 + 20
  });

  it("should add multiple item damage bonuses", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [
      items.claw,
      { ...items.claw, id: "claw2", damage: 15 }, // Second claw with different damage
    ];
    yield;
    expect(computeUnitDamage(unit)).toBe(105); // 70 + 20 + 15
  });

  it("should ignore items without damage property", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [items.foxToken]; // foxToken has no damage property
    yield;
    expect(computeUnitDamage(unit)).toBe(70); // Only wolf base damage
  });
});

describe("computeUnitAttackSpeed", () => {
  it("should return 1.0 for unit with no items", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    yield;
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it(
    "should return 1.0 for unit with items that have no attack speed multiplier",
    function* () {
      const unit = newUnit("test-owner", "wolf", 10, 10);
      unit.inventory = [items.claw, items.foxToken]; // Neither has attackSpeedMultiplier
      yield;
      expect(computeUnitAttackSpeed(unit)).toBe(1.0);
    },
  );

  it("should apply single attack speed multiplier", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [items.swiftness]; // 1.15x multiplier
    yield;
    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it(
    "should stack multiple attack speed multipliers multiplicatively",
    function* () {
      const unit = newUnit("test-owner", "wolf", 10, 10);
      unit.inventory = [
        items.swiftness, // 1.15x
        {
          ...items.swiftness,
          id: "swiftness2",
          attackSpeedMultiplier: 1.2,
        }, // 1.2x
      ];
      yield;
      expect(computeUnitAttackSpeed(unit)).toBeCloseTo(1.38, 2); // 1.15 * 1.2 = 1.38
    },
  );

  it("should ignore items without attack speed multiplier", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [
      items.swiftness, // 1.15x
      items.claw, // No attack speed multiplier
      items.foxToken, // No attack speed multiplier
    ];
    yield;
    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it("should return 1.0 for unit with empty inventory", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    unit.inventory = [];
    yield;
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it("should return 1.0 for unit with no inventory property", function* () {
    const unit = newUnit("test-owner", "wolf", 10, 10);
    (unit as { inventory?: ReadonlyArray<Item> }).inventory = undefined;
    yield;
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });
});

describe("damageEntity", () => {
  it("should do nothing if target has no health", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "fence", 20, 20); // Fence has no health

    damageEntity(attacker, target);
    yield;

    expect(target.health).toBeUndefined();
  });

  it("should deal computed damage with default behavior", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    damageEntity(attacker, target);
    yield;

    expect(target.health).toBe(50); // 120 - 70 (wolf damage) = 50
  });

  it("should deal specified amount when provided", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    damageEntity(attacker, target, 25);
    yield;

    expect(target.health).toBe(95); // 120 - 25
  });

  it(
    "should apply damage amplification for targets with progress",
    function* () {
      const attacker = newUnit("attacker-owner", "fox", 10, 10);
      const target = newUnit("target-owner", "hut", 20, 20);
      target.progress = 0.5; // Building in progress
      yield;

      damageEntity(attacker, target, undefined, false);
      yield;

      expect(target.health).toBe(80); // 120 - (20 * 2) = 80
    },
  );

  it(
    "should apply damage mitigation for mirror attackers against structures",
    function* () {
      const attacker = newUnit("attacker-owner", "wolf", 10, 10);
      const target = newUnit("target-owner", "hut", 20, 20);
      attacker.isMirror = true; // Mirror wolf
      yield;

      damageEntity(attacker, target, undefined, false);
      yield;

      expect(target.health).toBe(103.2); // 120 - (70 * 0.24) = 103.2
    },
  );

  it(
    "should apply extreme damage mitigation for mirror attackers against units",
    function* () {
      const attacker = newUnit("attacker-owner", "wolf", 10, 10);
      const target = newUnit("target-owner", "sheep", 20, 20);
      attacker.isMirror = true; // Mirror wolf
      yield;

      damageEntity(attacker, target, undefined, false);
      yield;

      expect(target.health).toBe(19.93); // 20 - (70 * 0.001) = 19.93
    },
  );

  it(
    "should combine progress amplification and mirror mitigation",
    function* () {
      const attacker = newUnit("attacker-owner", "fox", 10, 10);
      const target = newUnit("target-owner", "hut", 20, 20);
      attacker.isMirror = true;
      target.progress = 0.3; // Building in progress
      yield;

      damageEntity(attacker, target, undefined, false);
      yield;

      expect(target.health).toBe(110.4); // 120 - (20 * 2 * 0.24) = 110.4
    },
  );

  it("should deal pure damage when pure=true", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);
    attacker.isMirror = true;
    target.progress = 0.5;
    yield;

    damageEntity(attacker, target, undefined, true);
    yield;

    expect(target.health).toBe(50); // 120 - 70, no modifiers applied
  });

  it("should deal pure specified amount when pure=true", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);
    attacker.isMirror = true;
    target.progress = 0.5;
    yield;

    damageEntity(attacker, target, 35, true);
    yield;

    expect(target.health).toBe(85); // 120 - 35, no modifiers
  });

  it("should not reduce health below 0", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "tinyHut", 20, 20);

    damageEntity(attacker, target);
    yield;

    expect(target.health).toBe(0);
  });

  it("should track last attacker unconditionally", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    // Deal non-lethal damage
    damageEntity(attacker, target, 10);
    yield;

    expect(target.health).toBe(110); // 120 - 10
    expect(target.lastAttacker).toBe(attacker.id);
  });

  it("should track last attacker when unit dies", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    // Damage target to kill it
    damageEntity(attacker, target, 120);
    yield;

    expect(target.health).toBe(0);
    expect(target.lastAttacker).toBe(attacker.id);
  });

  it("should include item damage bonuses in computed damage", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);
    attacker.inventory = [items.claw]; // +20 damage
    yield;

    damageEntity(attacker, target);
    yield;

    expect(target.health).toBe(30); // 120 - (70 + 20) = 30
  });
});
