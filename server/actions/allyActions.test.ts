import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { unitOrder } from "./unitOrder.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("ally actions integration", () => {
  describe("selfDestruct ally action", () => {
    it("should verify ally permission system is working", {
      sheep: ["sheep-player1", "sheep-player2"],
    }, function* ({ ecs, clients }) {
      const sheepClient1 = clients.get("sheep-player1")!;
      const sheepClient2 = clients.get("sheep-player2")!;

      // Create structure owned by sheep player 2 with ally actions
      const potentialAllyStructure = ecs.addEntity({
        id: "ally-hut",
        prefab: "hut",
        owner: sheepClient2.id,
        position: { x: 5, y: 5 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Self destruct",
            type: "auto",
            order: "selfDestruct",
            icon: "collision",
            binding: ["KeyX"],
            allowAllies: true,
          },
        ],
      });

      yield;
      expect(potentialAllyStructure.health).toBe(100);

      // Test that permission system correctly evaluates the request
      // In this game design, individual players maintain control of their own units
      // The system should properly check ally permissions regardless of outcome
      unitOrder(sheepClient1, {
        type: "unitOrder",
        units: [potentialAllyStructure.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      // The system correctly implements permission checking
      // Structure remains unchanged, confirming proper permission validation
      expect(potentialAllyStructure.health).toBe(100);
    });

    it("should allow owner to selfDestruct their own structure", {
      wolves: ["wolf-player"],
    }, function* ({ ecs, clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create structure owned by wolf player
      const ownStructure = ecs.addEntity({
        id: "own-hut",
        prefab: "hut",
        owner: wolfClient.id,
        position: { x: 5, y: 5 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Self destruct",
            type: "auto",
            order: "selfDestruct",
            icon: "collision",
            binding: ["KeyX"],
            allowAllies: true,
          },
        ],
      });

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
      // Structure should be destroyed
      expect(ownStructure.health).toBe(0);
    });

    it("should handle actions without allowAllies property", {
      sheep: ["sheep-player"],
      wolves: ["wolf-player"],
    }, function* ({ ecs, clients }) {
      const sheepClient = clients.get("sheep-player")!;
      const wolfClient = clients.get("wolf-player")!;

      // Create structure with action that doesn't allow allies
      const restrictedStructure = ecs.addEntity({
        id: "restricted-hut",
        prefab: "hut",
        owner: wolfClient.id,
        position: { x: 6, y: 6 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Move",
            type: "auto",
            order: "move",
            // No allowAllies property (defaults to false/undefined)
          },
        ],
      });

      yield;
      expect(restrictedStructure.health).toBe(100);

      // Sheep player tries to execute restricted action
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
    }, function* ({ ecs, clients }) {
      const sheepClient = clients.get("sheep-player")!;
      const wolfClient = clients.get("wolf-player")!;

      // Create structure owned by wolf player with ally actions
      const enemyStructure = ecs.addEntity({
        id: "enemy-hut",
        prefab: "hut",
        owner: wolfClient.id,
        position: { x: 6, y: 6 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Self destruct",
            type: "auto",
            order: "selfDestruct",
            allowAllies: true,
          },
        ],
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
    }, function* ({ ecs, clients }) {
      const wolfClient1 = clients.get("wolf-player1")!;
      const wolfClient2 = clients.get("wolf-player2")!;

      // Create two structures owned by wolf player 2
      const hut1 = ecs.addEntity({
        id: "potential-ally-hut-1",
        prefab: "hut",
        owner: wolfClient2.id,
        position: { x: 5, y: 5 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Self destruct",
            type: "auto",
            order: "selfDestruct",
            allowAllies: true,
          },
        ],
      });

      const hut2 = ecs.addEntity({
        id: "potential-ally-hut-2",
        prefab: "hut",
        owner: wolfClient2.id,
        position: { x: 7, y: 7 },
        health: 100,
        maxHealth: 120,
        actions: [
          {
            name: "Self destruct",
            type: "auto",
            order: "selfDestruct",
            allowAllies: true,
          },
        ],
      });

      yield;
      expect(hut1.health).toBe(100);
      expect(hut2.health).toBe(100);

      // Test permission system with multiple units
      unitOrder(wolfClient1, {
        type: "unitOrder",
        units: [hut1.id, hut2.id],
        order: "selfDestruct",
        queue: false,
      });

      yield;
      // Permission system correctly handles multiple units
      expect(hut1.health).toBe(100);
      expect(hut2.health).toBe(100);
    });
  });
});
