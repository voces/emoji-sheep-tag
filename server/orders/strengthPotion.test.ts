import { afterEach, describe } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { unitOrder } from "../actions/unitOrder.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { addItem, damageEntity, newUnit } from "../api/unit.ts";
import { items } from "@/shared/data.ts";

afterEach(cleanupTest);

describe("strengthPotion integration", () => {
  describe("Potion of Strength item", () => {
    it("should add strength potion to inventory with correct properties", {
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf unit
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);

      yield;

      // Add strength potion to wolf's inventory
      const success = addItem(wolf, "strengthPotion");
      expect(success).toBe(true);
      expect(wolf.inventory).toHaveLength(1);
      expect(wolf.inventory![0].id).toBe("strengthPotion");
      expect(wolf.inventory![0].name).toBe("Potion of Strength");
      expect(wolf.inventory![0].charges).toBe(1);
    });

    it("should consume potion charge when used", {
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf unit with strength potion
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.strengthPotion];

      yield;

      // Use the strength potion
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "strengthPotion",
        queue: false,
      });

      yield;

      // Potion should be consumed from inventory
      expect(wolf.inventory).toHaveLength(0);
    });

    it("should apply strength buff when potion is used", {
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf unit with strength potion
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.strengthPotion];

      yield;

      // Use the strength potion
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "strengthPotion",
        queue: false,
      });

      yield;

      // Wolf should have strength buff
      expect(wolf.buffs).toHaveLength(1);
      expect(wolf.buffs![0].damageMultiplier).toBe(10.0);
      expect(wolf.buffs![0].consumeOnAttack).toBe(true);
      expect(wolf.buffs![0].remainingDuration).toBeCloseTo(300, 0);
    });
  });

  describe("Damage calculation with strength buff", () => {
    it("should deal 1000% increased damage with strength buff", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with base damage
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      // Add strength buff directly for testing damage calculation
      wolf.buffs = [{
        remainingDuration: 10,
        damageMultiplier: 10.0,
        consumeOnAttack: true,
      }];

      // Create target sheep
      const sheep = newUnit("sheep-player", "sheep", 6, 5);
      sheep.health = 1000; // High health to survive the attack
      sheep.maxHealth = 1000;

      yield;

      const originalSheepHealth = sheep.health;
      const wolfBaseDamage = wolf.attack?.damage || 0;

      // Wolf attacks sheep
      damageEntity(wolf, sheep);

      // Damage should be multiplied by 10 (1000% damage)
      const expectedDamage = wolfBaseDamage * 10;
      const actualDamage = originalSheepHealth - sheep.health;

      expect(actualDamage).toBe(expectedDamage);
      expect(sheep.health).toBe(originalSheepHealth - expectedDamage);
    });

    it("should stack strength buff with item damage bonuses", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with claw item (+20 damage) and strength buff
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.claw]; // +20 damage
      wolf.buffs = [{
        remainingDuration: 10,
        damageMultiplier: 10.0,
        consumeOnAttack: true,
      }];

      // Create target sheep
      const sheep = newUnit("sheep-player", "sheep", 6, 5);
      sheep.health = 1000;
      sheep.maxHealth = 1000;

      yield;

      const originalSheepHealth = sheep.health;
      const wolfBaseDamage = wolf.attack?.damage || 0;
      const clawDamage = 20;

      // Wolf attacks sheep
      damageEntity(wolf, sheep);

      // Damage should be (base + item bonus) * multiplier
      const expectedDamage = (wolfBaseDamage + clawDamage) * 10;
      const actualDamage = originalSheepHealth - sheep.health;

      expect(actualDamage).toBe(expectedDamage);
    });
  });

  describe("Buff consumption on attack", () => {
    it("should consume strength buff after direct damage", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with strength buff
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.buffs = [{
        remainingDuration: 300,
        damageMultiplier: 11.0,
        consumeOnAttack: true,
      }];

      // Create target sheep
      const sheep = newUnit("sheep-player", "sheep", 6, 5);
      sheep.health = 1000;
      sheep.maxHealth = 1000;

      yield;

      expect(wolf.buffs).toHaveLength(1);

      // Wolf attacks sheep directly
      damageEntity(wolf, sheep);

      // Strength buff should be consumed after attack
      expect(wolf.buffs).toHaveLength(0);
    });

    it("should not consume non-attack buffs on direct damage", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with both consumable and non-consumable buffs
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.buffs = [
        {
          remainingDuration: 300,
          damageMultiplier: 10.0,
          consumeOnAttack: true,
        },
        {
          remainingDuration: 100,
          attackSpeedMultiplier: 2.0,
          // consumeOnAttack is false/undefined
        },
      ];

      // Create target sheep
      const sheep = newUnit("sheep-player", "sheep", 6, 5);
      sheep.health = 1000;
      sheep.maxHealth = 1000;

      yield;

      expect(wolf.buffs).toHaveLength(2);

      // Wolf attacks sheep directly
      damageEntity(wolf, sheep);

      // Only consumeOnAttack buff should be removed
      expect(wolf.buffs).toHaveLength(1);
      expect(wolf.buffs![0].attackSpeedMultiplier).toBe(2.0);
      expect(wolf.buffs![0].damageMultiplier).toBeUndefined();
    });
  });

  describe("Full strength potion workflow", () => {
    it("should complete full potion usage workflow", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with strength potion
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.strengthPotion];

      // Create target sheep
      const sheep = newUnit("sheep-player", "sheep", 6, 5);
      sheep.health = 1000;
      sheep.maxHealth = 1000;

      yield;

      const wolfBaseDamage = wolf.attack?.damage || 0;
      const originalSheepHealth = sheep.health;

      // Step 1: Use strength potion
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "strengthPotion",
        queue: false,
      });

      yield;

      // Potion consumed, buff applied
      expect(wolf.inventory).toHaveLength(0);
      expect(wolf.buffs).toHaveLength(1);
      expect(wolf.buffs![0].damageMultiplier).toBe(10.0);

      // Step 2: Attack with buffed damage directly
      damageEntity(wolf, sheep);

      // Step 3: Verify enhanced damage and buff consumption
      const expectedDamage = wolfBaseDamage * 10;
      const actualDamage = originalSheepHealth - sheep.health;

      expect(actualDamage).toBe(expectedDamage);
      expect(wolf.buffs).toHaveLength(0); // Buff consumed

      // Step 4: Next attack should deal normal damage
      const healthAfterFirstAttack = sheep.health;

      damageEntity(wolf, sheep);

      const normalDamage = healthAfterFirstAttack - sheep.health;
      expect(normalDamage).toBe(wolfBaseDamage); // Normal damage, no multiplier
    });
  });
});
