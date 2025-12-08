import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { handlers } from "./messageHandlers.ts";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

const DEFAULT_LOBBY_SETTINGS = {
  map: "revo",
  mode: "survival" as const,
  vipHandicap: 0.8,
  sheep: 1,
  autoSheep: false,
  time: 300,
  autoTime: false,
  startingGold: { sheep: 25, wolves: 100 },
  income: { sheep: 1, wolves: 1 },
  view: false,
  teamGold: true,
  host: "player-0",
  shard: null,
  shards: [],
} as const;

describe("shard connection via message handlers", () => {
  describe("connectToShard handler", () => {
    it("receives connectToShard message with shard URL and token", () => {
      // Setup lobby first
      handlers.join({
        type: "join",
        lobby: "Test Lobby",
        status: "lobby",
        updates: [{ id: "player-0", isPlayer: true }],
        localPlayer: "player-0",
        lobbySettings: DEFAULT_LOBBY_SETTINGS,
        captainsDraft: null,
      });

      // The connectToShard handler should exist
      expect(typeof handlers.connectToShard).toBe("function");
    });
  });

  describe("shards in lobby settings", () => {
    it("receives shard list in lobby settings", () => {
      handlers.lobbySettings({
        type: "lobbySettings",
        ...DEFAULT_LOBBY_SETTINGS,
        shards: [
          {
            id: "shard-0",
            name: "US East",
            region: "New York",
            playerCount: 10,
            lobbyCount: 2,
            isOnline: true,
          },
          {
            id: "shard-1",
            name: "EU West",
            region: "London",
            playerCount: 5,
            lobbyCount: 1,
            isOnline: true,
          },
        ],
      });

      const settings = lobbySettingsVar();
      expect(settings.shards).toHaveLength(2);
      expect(settings.shards[0].name).toBe("US East");
      expect(settings.shards[1].name).toBe("EU West");
    });

    it("receives selected shard in lobby settings", () => {
      handlers.lobbySettings({
        type: "lobbySettings",
        ...DEFAULT_LOBBY_SETTINGS,
        shard: "shard-0",
        shards: [{
          id: "shard-0",
          name: "US East",
          region: "New York",
          playerCount: 10,
          lobbyCount: 2,
          isOnline: true,
        }],
      });

      const settings = lobbySettingsVar();
      expect(settings.shard).toBe("shard-0");
    });

    it("handles null shard (primary server)", () => {
      handlers.lobbySettings({
        type: "lobbySettings",
        ...DEFAULT_LOBBY_SETTINGS,
        shard: null,
        shards: [],
      });

      const settings = lobbySettingsVar();
      expect(settings.shard).toBeNull();
    });
  });

  describe("game state transitions with shards", () => {
    it("transitions to playing state when game starts on shard", () => {
      // Setup lobby
      handlers.join({
        type: "join",
        lobby: "Test Lobby",
        status: "lobby",
        updates: [
          { id: "player-0", isPlayer: true, team: "sheep" },
          { id: "player-1", isPlayer: true, team: "wolf" },
        ],
        localPlayer: "player-0",
        lobbySettings: {
          ...DEFAULT_LOBBY_SETTINGS,
          shard: "shard-0",
          shards: [{
            id: "shard-0",
            name: "US East",
            playerCount: 0,
            lobbyCount: 0,
            isOnline: true,
          }],
        },
        captainsDraft: null,
      });

      // Simulate start message (which would come from shard)
      handlers.start({
        type: "start",
        updates: [{ id: "player-0" }, { id: "player-1" }],
      });

      expect(stateVar()).toBe("playing");
    });

    it("returns to lobby state when game ends on shard", () => {
      // Setup playing state
      handlers.join({
        type: "join",
        lobby: "Test Lobby",
        status: "playing",
        updates: [
          { id: "player-0", isPlayer: true, team: "sheep" },
        ],
        localPlayer: "player-0",
        lobbySettings: DEFAULT_LOBBY_SETTINGS,
        captainsDraft: null,
      });

      expect(stateVar()).toBe("playing");

      // Simulate stop message from shard
      handlers.stop({
        type: "stop",
        updates: [{ id: "player-0", sheepCount: 1 }],
        round: {
          sheep: ["player-0"],
          wolves: ["player-1"],
          duration: 120000,
        },
      });

      expect(stateVar()).toBe("lobby");
    });
  });
});
