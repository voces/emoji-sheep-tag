import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  addPlayerToPracticeGame,
  deductPlayerGold,
  getPlayer,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { Client } from "../client.ts";

afterEach(cleanupTest);

describe("player API", () => {
  describe("getPlayer", () => {
    it(
      "should find player in wolves",
      { wolves: ["wolf-player"] },
      ({ clients }) => {
        const result = getPlayer("wolf-player");
        expect(result).toBe(clients.get("wolf-player")!.playerEntity);
      },
    );

    it(
      "should find player in sheep",
      { sheep: ["sheep-player"] },
      ({ clients }) => {
        const result = getPlayer("sheep-player");
        expect(result).toBe(clients.get("sheep-player")!.playerEntity);
      },
    );

    it("should return undefined for unknown player", () => {
      const result = getPlayer("unknown-player");
      expect(result).toBeUndefined();
    });
  });

  describe("grantPlayerGold", () => {
    it("should grant gold to player with existing gold", {
      wolves: ["test-player"],
      gold: 50,
    }, function* () {
      grantPlayerGold("test-player", 5);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(55, 0);
    });

    it("should grant gold to player with no existing gold", {
      wolves: ["test-player"],
      gold: 0,
    }, function* () {
      grantPlayerGold("test-player", 10);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(10, 0);
    });

    it("should handle unknown player gracefully", () => {
      grantPlayerGold("unknown-player", 10);

      expect(getPlayerGold("unknown-player")).toBe(0);
    });
  });

  describe("deductPlayerGold", () => {
    it("should deduct gold from player", {
      wolves: ["test-player"],
      gold: 50,
    }, function* () {
      deductPlayerGold("test-player", 15);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(35, 0);
    });
  });

  describe("addPlayerToPracticeGame", () => {
    it(
      "should add a new player to an ongoing practice game",
      { sheep: ["existing-player"], gold: 0 },
      ({ lobby, clients, ecs }) => {
        // Set practice mode
        lobby.round!.practice = true;

        // Create a new client to join mid-game
        const newClient = new Client({
          readyState: WebSocket.OPEN,
          send: () => {},
          close: () => {},
          addEventListener: () => {},
        });
        newClient.id = "new-player";
        newClient.name = "New Player";
        newClient.color = "#FF0000";
        clients.set("new-player", newClient);

        // Add player to practice game (within a batch to avoid update cycles)
        ecs.batch(() => {
          addPlayerToPracticeGame(newClient);
        });

        // Check player entity was created
        expect(newClient.playerEntity).toBeDefined();
        expect(newClient.playerEntity?.team).toBe("sheep");
        expect(newClient.playerEntity?.gold).toBe(100_000);
        expect(newClient.playerEntity?.name).toBe("New Player");

        // Check player was added to sheep team
        expect(lobby.round!.sheep.has(newClient)).toBe(true);

        // Check units were spawned
        const units = Array.from(lobby.round!.ecs.entities).filter((e) =>
          e.owner === "new-player"
        );
        expect(units.length).toBeGreaterThanOrEqual(3); // sheep, spirit, wolf

        const sheep = units.find((u) => u.prefab === "sheep");
        expect(sheep).toBeDefined();

        const spirit = units.find((u) => u.prefab === "spirit");
        expect(spirit).toBeDefined();

        const wolf = units.find((u) => u.prefab === "wolf");
        expect(wolf).toBeDefined();
        expect(wolf?.manaRegen).toBeGreaterThan(0);
      },
    );

    it(
      "should not add player if already has playerEntity",
      { sheep: ["existing-player"], gold: 0 },
      ({ lobby, clients, ecs }) => {
        lobby.round!.practice = true;

        const existingClient = clients.get("existing-player")!;
        const originalEntity = existingClient.playerEntity;

        // Try to add again
        ecs.batch(() => {
          addPlayerToPracticeGame(existingClient);
        });

        // Should keep original entity
        expect(existingClient.playerEntity).toBe(originalEntity);
      },
    );

    it(
      "should not add player if not in practice mode",
      { sheep: ["existing-player"], gold: 0 },
      ({ lobby, ecs }) => {
        // Keep practice mode false
        lobby.round!.practice = false;

        const newClient = new Client({
          readyState: WebSocket.OPEN,
          send: () => {},
          close: () => {},
          addEventListener: () => {},
        });
        newClient.id = "new-player";
        newClient.name = "New Player";

        ecs.batch(() => {
          addPlayerToPracticeGame(newClient);
        });

        // Should not create player entity
        expect(newClient.playerEntity).toBeUndefined();
      },
    );
  });
});
