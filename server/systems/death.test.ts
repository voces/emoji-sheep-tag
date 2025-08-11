import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { getPlayerGold } from "../api/player.ts";
import { damageEntity, newUnit } from "../api/unit.ts";
import { cleanupTest, createTestSetup } from "../testing/setup.ts";
// Import death system explicitly to ensure it's loaded
import "./death.ts";

afterEach(cleanupTest);

describe("death system bounty integration", () => {
  it("should grant bounty when wolf kills hut", () => {
    createTestSetup({
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
      gold: 10,
    });

    const wolf = newUnit("wolf-player", "wolf", 0, 0);
    const hut = newUnit("sheep-player", "hut", 5, 5);

    expect(getPlayerGold("wolf-player")).toBe(10);
    expect(hut.bounty).toBe(1);
    expect(hut.health).toBe(120);

    // Wolf damages the hut to death
    damageEntity(wolf, hut, 1000, true);

    expect(hut.health).toBe(0);
    expect(hut.lastAttacker).toBe(wolf.id);

    expect(getPlayerGold("wolf-player")).toBe(11);
  });

  it("should grant correct bounty amounts for different structures", () => {
    createTestSetup({
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
      gold: 0,
    });

    const wolf = newUnit("wolf-player", "wolf", 0, 0);

    // Test different bounty amounts
    const wideHut = newUnit("sheep-player", "wideHut", 5, 5);
    expect(wideHut.bounty).toBe(3);
    damageEntity(wolf, wideHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(3);

    const rotundHut = newUnit("sheep-player", "rotundHut", 10, 10);
    expect(rotundHut.bounty).toBe(4);
    damageEntity(wolf, rotundHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(7);

    const translocationHut = newUnit(
      "sheep-player",
      "translocationHut",
      15,
      15,
    );
    expect(translocationHut.bounty).toBe(5);
    damageEntity(wolf, translocationHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(12);
  });
});
