import { afterEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getShardInfoList, sendToShard } from "./shardRegistry.ts";
import { lobbies } from "./lobby.ts";
import { lobbyContext } from "./contexts.ts";

describe("shardRegistry", () => {
  afterEach(() => {
    // Clean up any lobbies created during tests
    for (const lobby of lobbies) {
      lobbies.delete(lobby);
    }
    lobbyContext.current = undefined;
  });

  describe("sendToShard", () => {
    it("sends JSON message to shard socket", () => {
      const sentMessages: string[] = [];
      const shard = {
        id: "test-shard",
        name: "Test",
        publicUrl: "ws://test:8080",
        socket: {
          readyState: WebSocket.OPEN,
          send: (data: string) => sentMessages.push(data),
          close: () => {},
          addEventListener: () => {},
        },
        lobbyCount: 0,
        playerCount: 0,
        lobbies: new Set<string>(),
      };

      sendToShard(shard, { type: "registered", shardId: "test-id" });

      expect(sentMessages).toHaveLength(1);
      expect(JSON.parse(sentMessages[0])).toEqual({
        type: "registered",
        shardId: "test-id",
      });
    });

    it("does nothing when socket is not open", () => {
      const sentMessages: string[] = [];
      const shard = {
        id: "test-shard",
        name: "Test",
        publicUrl: "ws://test:8080",
        socket: {
          readyState: WebSocket.CLOSED,
          send: (data: string) => sentMessages.push(data),
          close: () => {},
          addEventListener: () => {},
        },
        lobbyCount: 0,
        playerCount: 0,
        lobbies: new Set<string>(),
      };

      sendToShard(shard, { type: "registered", shardId: "test-id" });

      expect(sentMessages).toHaveLength(0);
    });

    it("handles send errors gracefully", () => {
      const shard = {
        id: "test-shard",
        name: "Test",
        publicUrl: "ws://test:8080",
        socket: {
          readyState: WebSocket.OPEN,
          send: () => {
            throw new Error("Send failed");
          },
          close: () => {},
          addEventListener: () => {},
        },
        lobbyCount: 0,
        playerCount: 0,
        lobbies: new Set<string>(),
      };

      // Should not throw
      expect(() =>
        sendToShard(shard, { type: "registered", shardId: "test-id" })
      ).not.toThrow();
    });

    it("sends assignLobby message correctly", () => {
      const sentMessages: string[] = [];
      const shard = {
        id: "test-shard",
        name: "Test",
        publicUrl: "ws://test:8080",
        socket: {
          readyState: WebSocket.OPEN,
          send: (data: string) => sentMessages.push(data),
          close: () => {},
          addEventListener: () => {},
        },
        lobbyCount: 0,
        playerCount: 0,
        lobbies: new Set<string>(),
      };

      sendToShard(shard, {
        type: "assignLobby",
        lobbyId: "test-lobby",
        settings: {
          map: "revo",
          mode: "survival",
          vipHandicap: 0.8,
          sheep: "auto",
          time: "auto",
          startingGold: { sheep: 0, wolves: 0 },
          income: { sheep: 1, wolves: 1 },
          view: false,
          teamGold: true,
        },
        players: [{
          id: "player-1",
          name: "Player 1",
          playerColor: "#ff0000",
          team: "sheep",
          token: "abc123",
        }],
        hostId: "player-1",
        practice: false,
        editor: false,
      });

      expect(sentMessages).toHaveLength(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe("assignLobby");
      expect(parsed.lobbyId).toBe("test-lobby");
      expect(parsed.players).toHaveLength(1);
      expect(parsed.players[0].token).toBe("abc123");
    });

    it("sends rejected message correctly", () => {
      const sentMessages: string[] = [];
      const shard = {
        id: "test-shard",
        name: "Test",
        publicUrl: "ws://test:8080",
        socket: {
          readyState: WebSocket.OPEN,
          send: (data: string) => sentMessages.push(data),
          close: () => {},
          addEventListener: () => {},
        },
        lobbyCount: 0,
        playerCount: 0,
        lobbies: new Set<string>(),
      };

      sendToShard(shard, {
        type: "rejected",
        reason: "Connection timeout",
      });

      expect(sentMessages).toHaveLength(1);
      expect(JSON.parse(sentMessages[0])).toEqual({
        type: "rejected",
        reason: "Connection timeout",
      });
    });
  });

  describe("getShardInfoList", () => {
    it("returns array type", () => {
      const shardList = getShardInfoList();

      expect(Array.isArray(shardList)).toBe(true);
    });
  });
});
