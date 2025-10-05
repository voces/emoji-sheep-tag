import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { leave } from "./lobbyApi.ts";
import { cleanupTest, it } from "./testing/setup.ts";
import { getPlayerGold, grantPlayerGold } from "./api/player.ts";
import { newUnit } from "./api/unit.ts";

afterEach(cleanupTest);

describe("leave - gold distribution", () => {
  it(
    "should distribute sheep gold to surviving allies when sheep player leaves",
    { sheep: ["sheep1", "sheep2", "sheep3"], wolves: ["wolf1"], gold: 0 },
    function* ({ clients }) {
      // Create sheep entities for all players
      newUnit("sheep1", "sheep", 10, 10);
      newUnit("sheep2", "sheep", 11, 10);
      newUnit("sheep3", "sheep", 12, 10);

      // Give gold to sheep players
      grantPlayerGold("sheep1", 100);
      grantPlayerGold("sheep2", 50);
      grantPlayerGold("sheep3", 0);

      yield;

      // Get initial gold
      const sheep1InitialGold = getPlayerGold("sheep1");
      const sheep2InitialGold = getPlayerGold("sheep2");
      const sheep3InitialGold = getPlayerGold("sheep3");

      // Sheep1 leaves
      leave(clients.get("sheep1"));

      // Check that gold was distributed
      const sheep2FinalGold = getPlayerGold("sheep2");
      const sheep3FinalGold = getPlayerGold("sheep3");

      // Total distributed should equal sheep1's gold
      const totalDistributed = (sheep2FinalGold - sheep2InitialGold) +
        (sheep3FinalGold - sheep3InitialGold);
      expect(totalDistributed).toBeCloseTo(sheep1InitialGold, 5);

      // Sheep3 (with 0 gold) should get more than sheep2 (with 50 gold)
      expect(sheep3FinalGold - sheep3InitialGold).toBeGreaterThan(
        sheep2FinalGold - sheep2InitialGold,
      );
    },
  );

  it(
    "should distribute wolf gold to surviving allies when wolf player leaves",
    { wolves: ["wolf1", "wolf2"], sheep: ["sheep1"], gold: 0 },
    function* ({ clients }) {
      // Create wolf entities
      newUnit("wolf1", "wolf", 10, 10);
      newUnit("wolf2", "wolf", 11, 10);

      // Give gold to wolves
      grantPlayerGold("wolf1", 75);
      grantPlayerGold("wolf2", 25);

      yield;

      // Get initial gold
      const wolf1InitialGold = getPlayerGold("wolf1");
      const wolf2InitialGold = getPlayerGold("wolf2");

      // Wolf1 leaves
      leave(clients.get("wolf1"));

      // Check that gold was distributed to wolf2
      const wolf2FinalGold = getPlayerGold("wolf2");
      expect(wolf2FinalGold - wolf2InitialGold).toBe(wolf1InitialGold);
    },
  );

  it(
    "should not distribute gold in practice mode",
    { sheep: ["sheep1", "sheep2"], wolves: ["wolf1"], gold: 0 },
    function* ({ lobby, clients }) {
      // Set practice mode
      lobby.round!.practice = true;

      // Create sheep entities
      newUnit("sheep1", "sheep", 10, 10);
      newUnit("sheep2", "sheep", 11, 10);

      // Give gold
      grantPlayerGold("sheep1", 100);
      grantPlayerGold("sheep2", 50);

      yield;

      const sheep2InitialGold = getPlayerGold("sheep2");

      // Sheep1 leaves
      leave(clients.get("sheep1"));

      // Gold should NOT be distributed in practice mode
      const sheep2FinalGold = getPlayerGold("sheep2");
      expect(sheep2FinalGold).toBe(sheep2InitialGold);
    },
  );
});
