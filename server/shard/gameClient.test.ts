import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { GameClient } from "./gameClient.ts";
import { ShardLobby } from "./shardLobby.ts";
import type { z } from "zod";
import type { zServerToShardMessage } from "@/shared/shard.ts";

type AssignLobbyMessage = Extract<
  z.infer<typeof zServerToShardMessage>,
  { type: "assignLobby" }
>;

const createMockSocket = () => ({
  readyState: WebSocket.OPEN,
  send: () => {},
  close: () => {},
  addEventListener: () => {},
});

const createAssignLobbyMessage = (
  overrides: Partial<AssignLobbyMessage> = {},
): AssignLobbyMessage => ({
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
  players: [],
  hostId: null,
  practice: false,
  editor: false,
  ...overrides,
});

describe("GameClient", () => {
  describe("constructor", () => {
    it("initializes with player info", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "player-1",
        name: "Test Player",
        playerColor: "#ff0000",
        team: "sheep",
      });

      expect(client.id).toBe("player-1");
      expect(client.name).toBe("Test Player");
      expect(client.playerColor).toBe("#ff0000");
      expect(client.team).toBe("sheep");
      expect(client.isPlayer).toBe(true);

      lobby.cleanup();
    });

    it("makes socket non-enumerable for JSON serialization", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "wolf",
      });

      const keys = Object.keys(client);
      expect(keys).not.toContain("socket");
      expect(keys).not.toContain("lobby");

      // But properties should still be accessible
      expect(client.socket).toBeDefined();
      expect(client.lobby).toBe(lobby);

      lobby.cleanup();
    });

    it("serializes to JSON without socket/lobby", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "wolf",
      });

      const json = JSON.stringify(client);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe("player-1");
      expect(parsed.name).toBe("Test");
      expect(parsed.socket).toBeUndefined();
      expect(parsed.lobby).toBeUndefined();

      lobby.cleanup();
    });
  });

  describe("send", () => {
    it("sends JSON message to socket", () => {
      const sentMessages: string[] = [];
      const socket = {
        readyState: WebSocket.OPEN,
        send: (data: string) => sentMessages.push(data),
        close: () => {},
        addEventListener: () => {},
      };

      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(socket, lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "sheep",
      });

      client.send({ type: "chat", message: "Hello" });

      expect(sentMessages).toHaveLength(1);
      expect(JSON.parse(sentMessages[0])).toEqual({
        type: "chat",
        message: "Hello",
      });

      lobby.cleanup();
    });

    it("does not send when socket is closed", () => {
      const sentMessages: string[] = [];
      const socket = {
        readyState: WebSocket.CLOSED,
        send: (data: string) => sentMessages.push(data),
        close: () => {},
        addEventListener: () => {},
      };

      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(socket, lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "sheep",
      });

      client.send({ type: "chat", message: "Hello" });

      expect(sentMessages).toHaveLength(0);

      lobby.cleanup();
    });
  });

  describe("rawSend", () => {
    it("sends raw string to socket", () => {
      const sentMessages: string[] = [];
      const socket = {
        readyState: WebSocket.OPEN,
        send: (data: string) => sentMessages.push(data),
        close: () => {},
        addEventListener: () => {},
      };

      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(socket, lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "sheep",
      });

      client.rawSend('{"type":"test"}');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toBe('{"type":"test"}');

      lobby.cleanup();
    });

    it("closes socket on send error", () => {
      let closeCalled = false;
      const socket = {
        readyState: WebSocket.OPEN,
        send: () => {
          throw new Error("Send failed");
        },
        close: () => {
          closeCalled = true;
        },
        addEventListener: () => {},
      };

      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(socket, lobby, {
        id: "player-1",
        name: "Test",
        playerColor: "#fff",
        team: "sheep",
      });

      client.rawSend("test");

      expect(closeCalled).toBe(true);

      lobby.cleanup();
    });
  });

  describe("team property", () => {
    it("can be sheep", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "p1",
        name: "Test",
        playerColor: "#fff",
        team: "sheep",
      });

      expect(client.team).toBe("sheep");
      lobby.cleanup();
    });

    it("can be wolf", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "p1",
        name: "Test",
        playerColor: "#fff",
        team: "wolf",
      });

      expect(client.team).toBe("wolf");
      lobby.cleanup();
    });

    it("can be observer", () => {
      const lobby = new ShardLobby(createAssignLobbyMessage());
      const client = new GameClient(createMockSocket(), lobby, {
        id: "p1",
        name: "Test",
        playerColor: "#fff",
        team: "observer",
      });

      expect(client.team).toBe("observer");
      lobby.cleanup();
    });
  });
});
