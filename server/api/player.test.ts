import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  deductPlayerGold,
  getPlayer,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newLobby } from "../lobby.ts";
import { newEcs } from "../ecs.ts";
import { interval } from "./timing.ts";
import { init } from "../st/data.ts";

afterEach(() => {
  try {
    lobbyContext.context.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
});

const setup = () => {
  const ecs = newEcs();
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    addEventListener: () => {},
  });
  client.id = "test-client";
  clientContext.context = client;
  const lobby = newLobby();
  lobbyContext.context = lobby;
  lobby.round = {
    sheep: new Set(),
    wolves: new Set(),
    ecs,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  init({
    sheep: [],
    wolves: [{ client }],
  });

  return { ecs, client, lobby };
};

describe("player API", () => {
  describe("getPlayer", () => {
    it("should find player in wolves", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "wolf-player";
      client.playerEntity = { id: "wolf-player" };

      lobbyContext.context.round!.wolves.add(client);

      const result = getPlayer("wolf-player");
      expect(result).toBe(client.playerEntity);
    });

    it("should find player in sheep", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "sheep-player";
      client.playerEntity = { id: "sheep-player" };

      lobbyContext.context.round!.sheep.add(client);

      const result = getPlayer("sheep-player");
      expect(result).toBe(client.playerEntity);
    });

    it("should return undefined for unknown player", () => {
      setup();

      const result = getPlayer("unknown-player");
      expect(result).toBeUndefined();
    });
  });

  describe("grantPlayerGold", () => {
    it("should grant gold to player with existing gold", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "test-player";
      client.playerEntity = { id: "player-entity", gold: 50 };

      lobbyContext.context.round!.wolves.add(client);

      grantPlayerGold("test-player", 5);

      expect(getPlayerGold("test-player")).toBe(55);
    });

    it("should grant gold to player with no existing gold", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "test-player";
      client.playerEntity = { id: "player-entity" };

      lobbyContext.context.round!.wolves.add(client);

      grantPlayerGold("test-player", 10);

      expect(getPlayerGold("test-player")).toBe(10);
    });

    it("should not grant negative or zero gold", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "test-player";
      client.playerEntity = { id: "player-entity", gold: 50 };

      lobbyContext.context.round!.wolves.add(client);

      grantPlayerGold("test-player", 0);
      grantPlayerGold("test-player", -5);

      expect(getPlayerGold("test-player")).toBe(50);
    });

    it("should handle unknown player gracefully", () => {
      setup();

      grantPlayerGold("unknown-player", 10);

      expect(getPlayerGold("unknown-player")).toBe(0);
    });
  });

  describe("deductPlayerGold", () => {
    it("should deduct gold from player", () => {
      setup();

      const client = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      client.id = "test-player";
      client.playerEntity = { id: "player-entity", gold: 50 };

      lobbyContext.context.round!.wolves.add(client);

      deductPlayerGold("test-player", 15);

      expect(getPlayerGold("test-player")).toBe(35);
    });
  });
});
