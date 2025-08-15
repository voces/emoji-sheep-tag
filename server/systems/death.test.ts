import { afterEach, describe } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { getPlayerGold } from "../api/player.ts";
import { damageEntity, newUnit } from "../api/unit.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("death system bounty integration", () => {
  it(
    "should grant bounty when wolf kills hut",
    function* () {
      const wolf = newUnit("wolf-player", "wolf", 0, 0);
      const hut = newUnit("sheep-player", "hut", 5, 5);
      yield;

      expect(getPlayerGold("wolf-player")).toBeCloseTo(10, 1);

      // Wolf damages the hut to death
      damageEntity(wolf, hut, 1000, true);
      yield;

      expect(hut.health).toBe(0);
      expect(hut.lastAttacker).toBe(wolf.id);
      expect(getPlayerGold("wolf-player")).toBeCloseTo(11, 1);
    },
  );

  it("should grant correct bounty amounts for different structures", {
    wolves: ["wolf-player"],
    sheep: ["sheep-player"],
    gold: 0,
  }, function* () {
    const wolf = newUnit("wolf-player", "wolf", 0, 0);
    const wideHut = newUnit("sheep-player", "wideHut", 5, 5);
    yield;

    damageEntity(wolf, wideHut, 1000, true);
    yield;

    expect(getPlayerGold("wolf-player")).toBeCloseTo(3, 1);

    const rotundHut = newUnit("sheep-player", "rotundHut", 10, 10);
    yield;

    damageEntity(wolf, rotundHut, 1000, true);
    yield;

    expect(getPlayerGold("wolf-player")).toBeCloseTo(7, 1);

    const translocationHut = newUnit(
      "sheep-player",
      "translocationHut",
      15,
      15,
    );
    yield;

    damageEntity(wolf, translocationHut, 1000, true);
    yield;

    expect(getPlayerGold("wolf-player")).toBeCloseTo(12, 1);
  });
});
