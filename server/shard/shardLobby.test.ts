import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ShardLobby } from "./shardLobby.ts";
import { GameClient } from "./gameClient.ts";
import { systemsLoaded } from "../ecs.ts";
import { lobbyContext } from "../contexts.ts";
import { appContext } from "@/shared/context.ts";
import { newUnit } from "../api/unit.ts";
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
    speedMultiplier: 1,
  },
  players: [],
  hostId: null,
  practice: false,
  editor: false,
  ...overrides,
});

describe("ShardLobby", () => {
  let lobby: ShardLobby;

  afterEach(() => {
    lobby?.cleanup();
  });

  describe("constructor", () => {
    it("initializes with assignment message properties", () => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        lobbyId: "my-lobby",
        hostId: "host-player",
        practice: true,
      }));

      expect(lobby.name).toBe("my-lobby");
      expect(lobby.hostId).toBe("host-player");
      expect(lobby.practice).toBe(true);
      expect(lobby.status).toBe("playing");
    });

    it("indexes expected players by token", () => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        players: [
          {
            id: "player-1",
            name: "Player 1",
            playerColor: "#ff0000",
            team: "sheep",
            token: "token-abc",
          },
          {
            id: "player-2",
            name: "Player 2",
            playerColor: "#00ff00",
            team: "wolf",
            token: "token-xyz",
          },
        ],
      }));

      expect(lobby.expectedPlayers.size).toBe(2);
      expect(lobby.expectedPlayers.get("token-abc")?.id).toBe("player-1");
      expect(lobby.expectedPlayers.get("token-xyz")?.id).toBe("player-2");
    });
  });

  describe("authenticatePlayer", () => {
    beforeEach(() => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        players: [{
          id: "player-1",
          name: "Player 1",
          playerColor: "#ff0000",
          team: "sheep",
          token: "valid-token",
        }],
      }));
    });

    it("returns player info for valid token", () => {
      const playerInfo = lobby.authenticatePlayer("valid-token");

      expect(playerInfo).toBeDefined();
      expect(playerInfo?.id).toBe("player-1");
      expect(playerInfo?.name).toBe("Player 1");
    });

    it("removes token after use (one-time use)", () => {
      lobby.authenticatePlayer("valid-token");

      expect(lobby.expectedPlayers.has("valid-token")).toBe(false);
    });

    it("returns undefined for invalid token", () => {
      const playerInfo = lobby.authenticatePlayer("invalid-token");

      expect(playerInfo).toBeUndefined();
    });

    it("returns undefined for already-used token", () => {
      lobby.authenticatePlayer("valid-token");
      const secondAttempt = lobby.authenticatePlayer("valid-token");

      expect(secondAttempt).toBeUndefined();
    });
  });

  describe("client management", () => {
    beforeEach(() => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        players: [{
          id: "player-1",
          name: "Player 1",
          playerColor: "#ff0000",
          team: "sheep",
          token: "token-1",
        }],
      }));
    });

    it("adds client to clients map", () => {
      const playerInfo = lobby.authenticatePlayer("token-1")!;
      const client = new GameClient(createMockSocket(), lobby, playerInfo);

      lobby.addClient(client);

      expect(lobby.clients.size).toBe(1);
      expect(lobby.clients.get("player-1")).toBe(client);
    });

    it("removes client from clients map", () => {
      const playerInfo = lobby.authenticatePlayer("token-1")!;
      const client = new GameClient(createMockSocket(), lobby, playerInfo);

      lobby.addClient(client);
      lobby.removeClient(client);

      expect(lobby.clients.size).toBe(0);
    });

    it("calls cleanup when last client disconnects", () => {
      let cleanupCalled = false;
      lobby.onEnd = () => {
        cleanupCalled = true;
      };

      const playerInfo = lobby.authenticatePlayer("token-1")!;
      const client = new GameClient(createMockSocket(), lobby, playerInfo);

      lobby.addClient(client);
      lobby.removeClient(client);

      expect(cleanupCalled).toBe(true);
    });

    it("players getter returns Set of clients", () => {
      const playerInfo = lobby.authenticatePlayer("token-1")!;
      const client = new GameClient(createMockSocket(), lobby, playerInfo);

      lobby.addClient(client);

      expect(lobby.players).toBeInstanceOf(Set);
      expect(lobby.players.size).toBe(1);
      expect(lobby.players.has(client)).toBe(true);
    });
  });

  describe("player leaving mid-round", () => {
    it("distributes their gold to surviving allies", async () => {
      await systemsLoaded;
      const players = [
        ["sheep-1", "sheep"],
        ["sheep-2", "sheep"],
        ["wolf-1", "wolf"],
      ] as const;
      lobby = new ShardLobby(createAssignLobbyMessage({
        settings: { ...createAssignLobbyMessage().settings, teamGold: false },
        players: players.map(([id, team]) => ({
          id,
          name: id,
          playerColor: "#ff0000",
          team,
          token: id,
        })),
      }));
      const clients = players.map(([id]) =>
        new GameClient(createMockSocket(), lobby, lobby.authenticatePlayer(id)!)
      );
      for (const client of clients) lobby.addClient(client);
      const player = (id: string) =>
        Array.from(lobby.round!.ecs.entities).find((e) => e.id === id)!;
      // The round spawns sheep after a countdown; place them now
      lobbyContext.with(
        lobby,
        () =>
          appContext.with(lobby.round!.ecs, () =>
            lobby.round!.ecs.batch(() => {
              newUnit("sheep-1", "sheep", 10, 10);
              newUnit("sheep-2", "sheep", 11, 10);
              player("sheep-1").gold = 30;
              player("sheep-2").gold = 0;
            })),
      );

      lobby.removeClient(clients[0]);

      expect(player("sheep-2").gold).toBe(30);
    });
  });

  describe("send", () => {
    it("broadcasts message to all clients", () => {
      const messages: string[] = [];
      const createTrackedSocket = () => ({
        readyState: WebSocket.OPEN,
        send: (data: string) => messages.push(data),
        close: () => {},
        addEventListener: () => {},
      });

      // Use practice mode to avoid auto-starting game when players connect
      lobby = new ShardLobby(createAssignLobbyMessage({
        practice: true,
        players: [
          {
            id: "p1",
            name: "P1",
            playerColor: "#fff",
            team: "sheep",
            token: "t1",
          },
          {
            id: "p2",
            name: "P2",
            playerColor: "#fff",
            team: "wolf",
            token: "t2",
          },
        ],
      }));

      const p1Info = lobby.authenticatePlayer("t1")!;
      const p2Info = lobby.authenticatePlayer("t2")!;
      const c1 = new GameClient(createTrackedSocket(), lobby, p1Info);
      const c2 = new GameClient(createTrackedSocket(), lobby, p2Info);

      lobby.addClient(c1);
      // Don't add c2 yet to avoid triggering startGame

      // Clear any messages from addClient
      messages.length = 0;

      // Manually add c2 to clients without triggering startGame
      lobby.clients.set(c2.id, c2);

      lobby.send({ type: "chat", message: "Hello" });

      expect(messages).toHaveLength(2);
      expect(JSON.parse(messages[0])).toEqual({
        type: "chat",
        message: "Hello",
      });
    });
  });

  describe("host getter", () => {
    it("returns host client when hostId is set", () => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        hostId: "player-1",
        players: [{
          id: "player-1",
          name: "Host",
          playerColor: "#fff",
          team: "sheep",
          token: "token-1",
        }],
      }));

      const playerInfo = lobby.authenticatePlayer("token-1")!;
      const client = new GameClient(createMockSocket(), lobby, playerInfo);
      lobby.addClient(client);

      expect(lobby.host).toBe(client);
    });

    it("returns undefined when hostId is null", () => {
      lobby = new ShardLobby(createAssignLobbyMessage({
        hostId: null,
      }));

      expect(lobby.host).toBeUndefined();
    });
  });
});
