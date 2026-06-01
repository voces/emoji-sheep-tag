import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { unitOrder } from "./unitOrder.ts";
import { newUnit } from "../api/unit.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("ally actions integration", () => {
  describe("selfDestruct ally action", () => {
    it("should verify ally permission system is working", {
      sheep: ["sheep-player1", "sheep-player2"],
    }, function* ({ clients }) {
      const sheepClient1 = clients.get("sheep-player1")!;
      const sheepClient2 = clients.get("sheep-player2")!;

      // Hut's built-in selfDestruct action has allowAllies: true
      const potentialAllyStructure = newUnit(sheepClient2.id, "hut", 5, 5, {
        health: 100,
      });

      yield;
      expect(potentialAllyStructure.health).toBe(100);

      // Ally sheep player can use selfDestruct on another sheep player's structure
      unitOrder(sheepClient1, {
        type: "unitOrder",
        units: [potentialAllyStructure.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      expect(potentialAllyStructure.health).toBe(0);
    });

    it("should allow owner to selfDestruct their own structure", {
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      const ownStructure = newUnit(wolfClient.id, "hut", 5, 5, { health: 100 });

      yield;
      expect(ownStructure.health).toBe(100);

      // Owner selfDestructs their own structure
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [ownStructure.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      expect(ownStructure.health).toBe(0);
    });

    it("should handle actions without allowAllies property", {
      sheep: ["sheep-player"],
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const sheepClient = clients.get("sheep-player")!;
      const wolfClient = clients.get("wolf-player")!;

      // Override the actions with one that doesn't opt into allowAllies
      const restrictedStructure = newUnit(wolfClient.id, "hut", 6, 6, {
        health: 100,
        actions: [{ name: "Move", type: "auto", order: "move" }],
      });

      yield;
      expect(restrictedStructure.health).toBe(100);

      // Non-owner tries to execute the restricted action
      unitOrder(sheepClient, {
        type: "unitOrder",
        units: [restrictedStructure.id],
        order: "move",
        queue: false,
      });

      yield;
      // Action should be blocked - structure should be unchanged
      expect(restrictedStructure.health).toBe(100);
    });

    it("should prevent enemies from using ally actions", {
      sheep: ["sheep-player"],
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const sheepClient = clients.get("sheep-player")!;
      const wolfClient = clients.get("wolf-player")!;

      // allowAllies only grants access to allies; enemies are still blocked
      const enemyStructure = newUnit(wolfClient.id, "hut", 6, 6, {
        health: 100,
      });

      yield;
      expect(enemyStructure.health).toBe(100);

      // Sheep player tries to selfDestruct enemy wolf structure (should be blocked)
      unitOrder(sheepClient, {
        type: "unitOrder",
        units: [enemyStructure.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      // Action should be blocked - structure should be unchanged
      expect(enemyStructure.health).toBe(100);
    });

    it("should handle multiple structures with permission validation", {
      wolves: ["wolf-player1", "wolf-player2"],
    }, function* ({ clients }) {
      const wolfClient1 = clients.get("wolf-player1")!;
      const wolfClient2 = clients.get("wolf-player2")!;

      const hut1 = newUnit(wolfClient2.id, "hut", 5, 5, { health: 100 });
      const hut2 = newUnit(wolfClient2.id, "hut", 7, 7, { health: 100 });

      yield;
      expect(hut1.health).toBe(100);
      expect(hut2.health).toBe(100);

      // Wolf player 1 can use selfDestruct on ally wolf player 2's structures
      unitOrder(wolfClient1, {
        type: "unitOrder",
        units: [hut1.id, hut2.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      expect(hut1.health).toBe(0);
      expect(hut2.health).toBe(0);
    });
  });
});
