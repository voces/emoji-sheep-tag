import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  addPlayerToPracticeGame,
  deductPlayerGold,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { Client } from "../client.ts";
import { getTeamGold, SHEEP_INDIVIDUAL_GOLD_CAP } from "./teamGold.ts";

afterEach(cleanupTest);

describe("player API", () => {
  describe("getPlayer", () => {
    it(
      "should find player in wolves",
      { wolves: ["wolf-player"] },
      () => {
        const result = getPlayer("wolf-player");
        expect(result?.id).toBe("wolf-player");
        expect(result?.team).toBe("wolf");
        expect(result?.isPlayer).toBe(true);
      },
    );

    it(
      "should find player in sheep",
      { sheep: ["sheep-player"] },
      () => {
        const result = getPlayer("sheep-player");
        expect(result?.id).toBe("sheep-player");
        expect(result?.team).toBe("sheep");
        expect(result?.isPlayer).toBe(true);
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
        newClient.playerColor = "#FF0000";
        clients.set("new-player", newClient);

        // Add player to practice game (within a batch to avoid update cycles)
        ecs.batch(() => {
          addPlayerToPracticeGame(newClient);
        });

        // Check player entity was created in ECS with correct properties
        const playerEntity = Array.from(ecs.entities).find((e) =>
          e.id === "new-player" && e.isPlayer
        );
        expect(playerEntity).toBeDefined();
        expect(playerEntity?.team).toBe("sheep");
        expect(playerEntity?.gold).toBe(100_000);
        expect(playerEntity?.name).toBe("New Player");

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
      "should not add player if already has team assigned",
      { sheep: ["existing-player"], gold: 0 },
      ({ lobby, clients, ecs }) => {
        lobby.round!.practice = true;

        const existingClient = clients.get("existing-player")!;
        const existingPlayerEntity = Array.from(ecs.entities).find((e) =>
          e.id === "existing-player" && e.isPlayer
        )!;
        const originalTeam = existingPlayerEntity.team;
        const originalGold = existingPlayerEntity.gold;

        // Try to add again
        ecs.batch(() => {
          addPlayerToPracticeGame(existingClient);
        });

        // Should keep original properties
        expect(existingPlayerEntity.team).toBe(originalTeam);
        expect(existingPlayerEntity.gold).toBe(originalGold);
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

        // Should keep default "pending" team (not changed by addPlayerToPracticeGame)
        expect(newClient.team).toBe("pending");
      },
    );
  });

  describe("team gold", () => {
    describe("wolves", () => {
      it("should grant gold to team pool instead of individual", {
        wolves: ["wolf-player"],
        gold: 0,
        teamGold: true,
      }, function* () {
        const player = getPlayer("wolf-player")!;
        expect(player.gold).toBe(0);

        grantPlayerGold("wolf-player", 50);
        yield;

        // Wolf individual gold should remain 0
        expect(player.gold).toBe(0);
        // Team gold should have the amount (using toBeCloseTo due to gold generation)
        expect(getTeamGold("wolf")).toBeCloseTo(50, 0);
        // Effective gold should return team gold
        expect(getPlayerGold("wolf-player")).toBeCloseTo(50, 0);
      });

      it("should deduct gold from team pool", {
        wolves: ["wolf-player"],
        gold: 100,
        teamGold: true,
      }, function* () {
        // Team starts with 100 gold (from setup)
        expect(getTeamGold("wolf")).toBe(100);

        deductPlayerGold("wolf-player", 30);
        yield;

        expect(getTeamGold("wolf")).toBeCloseTo(70, 0);
        expect(getPlayerGold("wolf-player")).toBeCloseTo(70, 0);
      });
    });

    describe("sheep", () => {
      it("should fill individual gold up to cap, overflow to team", {
        sheep: ["sheep-player"],
        gold: 0,
        teamGold: true,
      }, function* () {
        const player = getPlayer("sheep-player")!;
        expect(player.gold).toBe(0);

        // Grant more than the cap
        grantPlayerGold("sheep-player", 50);
        yield;

        // Individual should be at cap
        expect(player.gold).toBeCloseTo(SHEEP_INDIVIDUAL_GOLD_CAP, 0);
        // Overflow should go to team
        expect(getTeamGold("sheep")).toBeCloseTo(
          50 - SHEEP_INDIVIDUAL_GOLD_CAP,
          0,
        );
        // Effective gold = individual + team
        expect(getPlayerGold("sheep-player")).toBeCloseTo(50, 0);
      });

      it("should deduct from team pool first, then individual", {
        sheep: ["sheep-player"],
        gold: SHEEP_INDIVIDUAL_GOLD_CAP,
        teamGold: true,
      }, function* () {
        const player = getPlayer("sheep-player")!;
        // Start with cap individual gold
        expect(player.gold).toBe(SHEEP_INDIVIDUAL_GOLD_CAP);

        // Add some team gold
        grantPlayerGold("sheep-player", 30);
        yield;

        // Should have cap individual + 30 team
        expect(player.gold).toBeCloseTo(SHEEP_INDIVIDUAL_GOLD_CAP, 0);
        expect(getTeamGold("sheep")).toBeCloseTo(30, 0);

        // Deduct 40 (more than team gold)
        deductPlayerGold("sheep-player", 40);
        yield;

        // Should deduct all 30 from team, then 10 from individual
        expect(getTeamGold("sheep")).toBeCloseTo(0, 0);
        expect(player.gold).toBeCloseTo(SHEEP_INDIVIDUAL_GOLD_CAP - 10, 0);
      });

      it("should return combined individual and team gold", {
        sheep: ["sheep-player"],
        gold: 15,
        teamGold: true,
      }, function* () {
        const player = getPlayer("sheep-player")!;
        expect(player.gold).toBe(15);

        // Add gold that overflows to team
        grantPlayerGold("sheep-player", 10);
        yield;

        // Individual should be at cap (15 + 5 = 20)
        expect(player.gold).toBeCloseTo(SHEEP_INDIVIDUAL_GOLD_CAP, 0);
        // Overflow to team (5)
        expect(getTeamGold("sheep")).toBeCloseTo(5, 0);
        // Effective = 20 + 5 = 25
        expect(getPlayerGold("sheep-player")).toBeCloseTo(25, 0);
      });
    });
  });
});
