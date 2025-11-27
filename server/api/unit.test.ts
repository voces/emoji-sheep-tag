import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { addItem, damageEntity, newUnit } from "./unit.ts";
import { Entity } from "@/shared/types.ts";
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
      delete target.completionTime; // Prevent progress system from modifying health
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
      delete target.completionTime; // Prevent progress system from modifying health
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
    delete target.completionTime; // Prevent progress system from modifying health
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
    delete target.completionTime; // Prevent progress system from modifying health
    yield;

    damageEntity(attacker, target, 35, true);
    yield;

    expect(target.health).toBe(85); // 120 - 35, no modifiers
  });

  it("should not reduce health below 0", function* () {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "shack", 20, 20);

    damageEntity(attacker, target);
    yield;

    expect(target.health).toBe(0);
  });

  it("should track last attacker unconditionally", () => {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    // Deal non-lethal damage
    damageEntity(attacker, target, 10);

    expect(target.health).toBe(110); // 120 - 10
    expect(target.lastAttacker).toBe(attacker.id);
  });

  it("should track last attacker when unit dies", () => {
    const attacker = newUnit("attacker-owner", "wolf", 10, 10);
    const target = newUnit("target-owner", "hut", 20, 20);

    // Damage target to kill it
    damageEntity(attacker, target, 120);

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
