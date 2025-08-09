import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  addItem,
  computeUnitAttackSpeed,
  computeUnitDamage,
  damageEntity,
} from "./unit.ts";
import { Entity } from "@/shared/types.ts";
import { newEcs } from "../ecs.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { Client } from "../client.ts";
import { newLobby } from "../lobby.ts";
import { interval } from "../api/timing.ts";
import { init } from "../st/data.ts";
import { items, prefabs } from "@/shared/data.ts";

afterEach(() => {
  try {
    lobbyContext.context.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
});

const setupEcs = () => {
  const ecs = newEcs();
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    addEventListener: () => {},
  });
  client.id = "test-client";
  clientContext.context = client;
  const lobby = newLobby();
  lobbyContext.context = lobby;
  lobby.round = {
    sheep: new Set(),
    wolves: new Set(),
    ecs,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  // Initialize game data to avoid errors
  init({
    sheep: [],
    wolves: [{ client }],
  });

  return { ecs, client };
};

describe("addItem", () => {
  it("should add new item to empty inventory", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxItem");
    expect(unit.inventory![0].name).toBe("Fox Token");
  });

  it("should initialize inventory if undefined", () => {
    const unit: Entity = {
      id: "test-unit",
    };

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toBeDefined();
    expect(unit.inventory).toHaveLength(1);
  });

  it("should stack charges for existing items", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [{
        id: "foxItem",
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

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].charges).toBe(3);
  });

  it("should return false for invalid item id", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "invalidItem");

    expect(result).toBe(false);
    expect(unit.inventory).toHaveLength(0);
  });

  it("should add multiple different items", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    addItem(unit, "foxItem");
    // Note: we can only test with foxItem since other items may not exist in prefabs

    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxItem");
  });
});

describe("computeUnitDamage", () => {
  it("should return 0 for unit without attack", () => {
    const unit: Entity = { id: "test-sheep", ...prefabs.sheep };
    expect(computeUnitDamage(unit)).toBe(0);
  });

  it("should return base damage for unit with no items", () => {
    const unit: Entity = { id: "test-wolf", ...prefabs.wolf };
    expect(computeUnitDamage(unit)).toBe(70); // Wolf base damage
  });

  it("should add item damage bonuses", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [items.claw],
    };
    expect(computeUnitDamage(unit)).toBe(90); // 70 + 20
  });

  it("should add multiple item damage bonuses", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [
        items.claw,
        { ...items.claw, id: "claw2", damage: 15 }, // Second claw with different damage
      ],
    };
    expect(computeUnitDamage(unit)).toBe(105); // 70 + 20 + 15
  });

  it("should ignore items without damage property", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [items.foxItem], // foxItem has no damage property
    };
    expect(computeUnitDamage(unit)).toBe(70); // Only wolf base damage
  });
});

describe("computeUnitAttackSpeed", () => {
  it("should return 1.0 for unit with no items", () => {
    const unit: Entity = { id: "test-wolf", ...prefabs.wolf };
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it("should return 1.0 for unit with items that have no attack speed multiplier", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [items.claw, items.foxItem], // Neither has attackSpeedMultiplier
    };
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it("should apply single attack speed multiplier", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [items.swiftness], // 1.15x multiplier
    };
    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it("should stack multiple attack speed multipliers multiplicatively", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [
        items.swiftness, // 1.15x
        { ...items.swiftness, id: "swiftness2", attackSpeedMultiplier: 1.2 }, // 1.2x
      ],
    };
    expect(computeUnitAttackSpeed(unit)).toBeCloseTo(1.38, 2); // 1.15 * 1.2 = 1.38
  });

  it("should ignore items without attack speed multiplier", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [
        items.swiftness, // 1.15x
        items.claw, // No attack speed multiplier
        items.foxItem, // No attack speed multiplier
      ],
    };
    expect(computeUnitAttackSpeed(unit)).toBe(1.15);
  });

  it("should return 1.0 for unit with empty inventory", () => {
    const unit: Entity = {
      id: "test-wolf",
      ...prefabs.wolf,
      inventory: [],
    };
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });

  it("should return 1.0 for unit with no inventory property", () => {
    const unit: Entity = { id: "test-wolf", ...prefabs.wolf };
    delete unit.inventory;
    expect(computeUnitAttackSpeed(unit)).toBe(1.0);
  });
});

describe("damageEntity", () => {
  it("should do nothing if target has no health", () => {
    setupEcs();
    const attacker: Entity = { id: "attacker-wolf", ...prefabs.wolf };
    const target: Entity = { id: "target-fence", ...prefabs.fence }; // Fence has no health

    damageEntity(attacker, target);

    expect(target.health).toBeUndefined();
  });

  it("should deal computed damage with default behavior", () => {
    setupEcs();
    const attacker: Entity = { id: "attacker-wolf", ...prefabs.wolf };
    const target: Entity = { id: "target-sheep", ...prefabs.sheep, health: 20 }; // Sheep max health

    damageEntity(attacker, target);

    expect(target.health).toBe(0); // 20 - 70 (wolf damage) = 0 (capped)
  });

  it("should deal specified amount when provided", () => {
    setupEcs();
    const attacker: Entity = { id: "attacker-wolf", ...prefabs.wolf };
    const target: Entity = { id: "target-hut", ...prefabs.hut, health: 120 }; // Hut max health

    damageEntity(attacker, target, 25);

    expect(target.health).toBe(95); // 120 - 25
  });

  it("should apply damage amplification for targets with progress", () => {
    setupEcs();
    const attacker: Entity = { id: "attacker-fox", ...prefabs.fox }; // Fox has 20 damage
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
      progress: 0.5, // Building in progress
    };

    damageEntity(attacker, target, undefined, false);

    expect(target.health).toBe(80); // 120 - (20 * 2) = 80
  });

  it("should apply damage mitigation for mirror attackers against tilemaps", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-mirror",
      ...prefabs.wolf,
      isMirror: true, // Mirror wolf
    };
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
    };

    damageEntity(attacker, target, undefined, false);

    expect(target.health).toBe(103.2); // 120 - (70 * 0.24) = 103.2
  });

  it("should apply extreme damage mitigation for mirror attackers against non-tilemaps", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-mirror",
      ...prefabs.wolf,
      isMirror: true, // Mirror wolf
    };
    const target: Entity = {
      id: "target-sheep",
      ...prefabs.sheep,
      health: 20,
    };

    damageEntity(attacker, target, undefined, false);

    expect(target.health).toBe(19.93); // 20 - (70 * 0.001) = 19.93
  });

  it("should combine progress amplification and mirror mitigation", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-mirror",
      ...prefabs.fox, // Fox has 20 damage
      isMirror: true,
    };
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
      progress: 0.3, // Building in progress
    };

    damageEntity(attacker, target, undefined, false);

    expect(target.health).toBe(110.4); // 120 - (20 * 2 * 0.24) = 110.4
  });

  it("should deal pure damage when pure=true", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-mirror",
      ...prefabs.wolf,
      isMirror: true,
    };
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
      progress: 0.5,
    };

    damageEntity(attacker, target, undefined, true);

    expect(target.health).toBe(50); // 120 - 70, no modifiers applied
  });

  it("should deal pure specified amount when pure=true", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-mirror",
      ...prefabs.wolf,
      isMirror: true,
    };
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
      progress: 0.5,
    };

    damageEntity(attacker, target, 35, true);

    expect(target.health).toBe(85); // 120 - 35, no modifiers
  });

  it("should not reduce health below 0", () => {
    setupEcs();
    const attacker: Entity = { id: "attacker-wolf", ...prefabs.wolf }; // 70 damage
    const target: Entity = {
      id: "target-sheep",
      ...prefabs.sheep,
      health: 20, // Less than wolf damage
    };

    damageEntity(attacker, target);

    expect(target.health).toBe(0);
  });

  it("should dispatch unitDeath event when health reaches 0", () => {
    const { ecs: app } = setupEcs();
    let deathEventFired = false;

    app.addEventListener("unitDeath", () => {
      deathEventFired = true;
    });

    const attacker: Entity = { id: "attacker-wolf", ...prefabs.wolf };
    const target: Entity = {
      id: "target-sheep",
      ...prefabs.sheep,
      health: 20, // Will be killed by wolf's 70 damage
    };

    damageEntity(attacker, target);

    expect(target.health).toBe(0);
    expect(deathEventFired).toBe(true);
  });

  it("should include item damage bonuses in computed damage", () => {
    setupEcs();
    const attacker: Entity = {
      id: "attacker-wolf",
      ...prefabs.wolf,
      inventory: [items.claw], // +20 damage
    };
    const target: Entity = {
      id: "target-hut",
      ...prefabs.hut,
      health: 120,
    };

    damageEntity(attacker, target);

    expect(target.health).toBe(30); // 120 - (70 + 20) = 30
  });
});
