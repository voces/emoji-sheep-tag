import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Client } from "../client.ts";
import { newLobby } from "../lobby.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { lobbySettings } from "./lobbySettings.ts";

let mockMessages: Array<{ type: string; [key: string]: unknown }> = [];

const createMockClient = (isHost = false): Client => {
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: (data: string) => {
      mockMessages.push(JSON.parse(data));
    },
    close: () => {},
    addEventListener: () => {},
  });
  client.id = isHost ? "host-client" : "non-host-client";
  return client;
};

describe("lobbySettings action", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should update starting gold when host makes changes", () => {
    const hostClient = createMockClient(true);
    const lobby = newLobby(hostClient);
    lobby.players.add(hostClient);

    // Set initial settings
    lobby.settings.startingGold = { sheep: 100, wolves: 150 };

    // IMPORTANT: Set client's lobby reference
    hostClient.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = hostClient;

    // Host updates settings
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 200, wolves: 250 },
    });

    // Settings should be updated
    expect(lobby.settings.startingGold).toEqual({ sheep: 200, wolves: 250 });

    // Should broadcast to all players
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0]).toEqual({
      type: "lobbySettings",
      sheep: 1,
      autoSheep: true,
      time: 120,
      autoTime: true,
      startingGold: { sheep: 200, wolves: 250 },
      income: { sheep: 1, wolves: 1 },
    });
  });

  it("should reject changes from non-host players", () => {
    const hostClient = createMockClient(true);
    const nonHostClient = createMockClient(false);
    const lobby = newLobby(hostClient);

    lobby.players.add(hostClient);
    lobby.players.add(nonHostClient);

    // Set initial settings
    lobby.settings.startingGold = { sheep: 100, wolves: 150 };

    // Set lobby references
    hostClient.lobby = lobby;
    nonHostClient.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = nonHostClient;

    // Non-host tries to update settings
    lobbySettings(nonHostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 999, wolves: 999 },
    });

    // Settings should remain unchanged
    expect(lobby.settings.startingGold).toEqual({ sheep: 100, wolves: 150 });

    // Should not broadcast any messages
    expect(mockMessages).toHaveLength(0);
  });

  it("should handle undefined startingGold gracefully", () => {
    const hostClient = createMockClient(true);
    const lobby = newLobby(hostClient);
    lobby.players.add(hostClient);

    // Set initial settings
    lobby.settings.startingGold = { sheep: 100, wolves: 150 };

    hostClient.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = hostClient;

    // Host sends message without startingGold
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: undefined,
    });

    // Settings should remain unchanged
    expect(lobby.settings.startingGold).toEqual({ sheep: 100, wolves: 150 });

    // Should still broadcast current settings
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0]).toEqual({
      type: "lobbySettings",
      sheep: 1,
      autoSheep: true,
      time: 120,
      autoTime: true,
      startingGold: { sheep: 100, wolves: 150 },
      income: { sheep: 1, wolves: 1 },
    });
  });

  it("should handle partial startingGold updates", () => {
    const hostClient = createMockClient(true);
    const lobby = newLobby(hostClient);
    lobby.players.add(hostClient);

    // Set initial settings
    lobby.settings.startingGold = { sheep: 100, wolves: 150 };

    hostClient.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = hostClient;

    // Host updates only sheep gold
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 300, wolves: 150 },
    });

    // Settings should be updated
    expect(lobby.settings.startingGold).toEqual({ sheep: 300, wolves: 150 });

    // Should broadcast updated settings
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0]).toEqual({
      type: "lobbySettings",
      sheep: 1,
      autoSheep: true,
      time: 120,
      autoTime: true,
      startingGold: { sheep: 300, wolves: 150 },
      income: { sheep: 1, wolves: 1 },
    });
  });

  it("should reject when client has no lobby", () => {
    const hostClient = createMockClient(true);

    clientContext.current = hostClient;
    lobbyContext.current = undefined;

    // Try to update settings without a lobby
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 200, wolves: 250 },
    });

    // Should not broadcast any messages
    expect(mockMessages).toHaveLength(0);
  });

  it("should broadcast to multiple players in lobby", () => {
    const hostClient = createMockClient(true);
    const player1 = createMockClient(false);
    const player2 = createMockClient(false);

    player1.id = "player1";
    player2.id = "player2";

    const lobby = newLobby(hostClient);
    lobby.players.add(hostClient);
    lobby.players.add(player1);
    lobby.players.add(player2);

    // Set initial settings
    lobby.settings.startingGold = { sheep: 50, wolves: 75 };

    hostClient.lobby = lobby;
    player1.lobby = lobby;
    player2.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = hostClient;

    // Host updates settings
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 400, wolves: 500 },
    });

    // Settings should be updated
    expect(lobby.settings.startingGold).toEqual({ sheep: 400, wolves: 500 });

    // Should broadcast to all 3 players (host + 2 others)
    // Note: The send function broadcasts to all players in the lobby
    expect(mockMessages).toHaveLength(3);
    mockMessages.forEach((message) => {
      expect(message).toEqual({
        type: "lobbySettings",
        sheep: 1,
        autoSheep: true,
        time: 120,
        autoTime: true,
        startingGold: { sheep: 400, wolves: 500 },
        income: { sheep: 1, wolves: 1 },
      });
    });
  });

  it("should validate gold values within bounds", () => {
    const hostClient = createMockClient(true);
    const lobby = newLobby(hostClient);
    lobby.players.add(hostClient);

    lobby.settings.startingGold = { sheep: 100, wolves: 150 };

    hostClient.lobby = lobby;

    lobbyContext.current = lobby;
    clientContext.current = hostClient;

    // Test boundary values
    lobbySettings(hostClient, {
      type: "lobbySettings",
      startingGold: { sheep: 0, wolves: 1000 },
    });

    expect(lobby.settings.startingGold).toEqual({ sheep: 0, wolves: 1000 });

    // Should broadcast the boundary values
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0]).toEqual({
      type: "lobbySettings",
      sheep: 1,
      autoSheep: true,
      time: 120,
      autoTime: true,
      startingGold: { sheep: 0, wolves: 1000 },
      income: { sheep: 1, wolves: 1 },
    });
  });
});
