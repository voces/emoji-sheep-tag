import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Client } from "../client.ts";
import { newLobby } from "../lobby.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import {
  cancelCaptains,
  captainPick,
  handleCaptainsPlayerLeave,
  randomCaptains,
  selectCaptain,
  startCaptains,
} from "./captains.ts";

let mockMessages: Array<{ type: string; [key: string]: unknown }> = [];

const createMockClient = (id: string): Client => {
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: (data: string) => {
      mockMessages.push(JSON.parse(data));
    },
    close: () => {},
    addEventListener: () => {},
  });
  client.id = id;
  client.team = "sheep";
  return client;
};

const setupLobby = (playerCount: number) => {
  const host = createMockClient("host");
  const lobby = newLobby(host);
  lobby.players.add(host);
  host.lobby = lobby;

  const players = [host];
  for (let i = 1; i < playerCount; i++) {
    const player = createMockClient(`player-${i}`);
    player.lobby = lobby;
    lobby.players.add(player);
    players.push(player);
  }

  lobbyContext.current = lobby;
  clientContext.current = host;

  return { lobby, host, players };
};

describe("startCaptains", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should start captains draft with 3+ players", () => {
    const { lobby, host } = setupLobby(3);

    startCaptains(host);

    expect(lobby.captainsDraft).toBeDefined();
    expect(lobby.captainsDraft?.phase).toBe("selecting-captains");
    expect(lobby.captainsDraft?.captains).toEqual([]);
    expect(lobby.captainsDraft?.picks).toEqual([[], []]);
  });

  it("should not start with fewer than 3 players", () => {
    const { lobby, host } = setupLobby(2);

    startCaptains(host);

    expect(lobby.status).toBe("lobby");
    expect(lobby.captainsDraft).toBeUndefined();
  });

  it("should not start if not host", () => {
    const { lobby, players } = setupLobby(3);
    const nonHost = players[1];

    startCaptains(nonHost);

    expect(lobby.status).toBe("lobby");
    expect(lobby.captainsDraft).toBeUndefined();
  });

  it("should not count observers toward player count", () => {
    const { lobby, host, players } = setupLobby(4);
    players[1].team = "observer";
    players[2].team = "observer";

    startCaptains(host);

    // Only 2 non-observers (host + player-3), so should not start
    expect(lobby.status).toBe("lobby");
    expect(lobby.captainsDraft).toBeUndefined();
  });
});

describe("selectCaptain", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should select first captain", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);
    mockMessages = [];

    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    expect(lobby.captainsDraft?.captains).toEqual(["player-1"]);
    expect(lobby.captainsDraft?.phase).toBe("selecting-captains");
  });

  it("should move to drafting after selecting second captain", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);

    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[2].id });

    expect(lobby.captainsDraft?.captains).toEqual(["player-1", "player-2"]);
    expect(lobby.captainsDraft?.phase).toBe("drafting");
  });

  it("should not allow selecting the same captain twice", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);

    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    expect(lobby.captainsDraft?.captains).toEqual(["player-1"]);
  });

  it("should not allow non-host to select captains", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);

    selectCaptain(players[1], {
      type: "selectCaptain",
      playerId: players[2].id,
    });

    expect(lobby.captainsDraft?.captains).toEqual([]);
  });

  it("should auto-draft when only 1 player remains after selecting captains (3 players)", () => {
    const { lobby, host, players } = setupLobby(3);
    startCaptains(host);

    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    // With 3 players and 2 captains, only 1 remains - should auto-draft
    expect(lobby.captainsDraft?.phase).toBe("drafted");
    expect(lobby.status).toBe("lobby");
    // Captain 0 (sheep) should have the remaining player
    expect(players[2].team).toBe("sheep");
  });
});

describe("randomCaptains", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should randomly select 2 captains and move to drafting", () => {
    const { lobby, host, players } = setupLobby(5);
    startCaptains(host);

    randomCaptains(host);

    expect(lobby.captainsDraft?.captains).toHaveLength(2);
    expect(lobby.captainsDraft?.phase).toBe("drafting");
    // Captains should be from the player list
    for (const captainId of lobby.captainsDraft?.captains ?? []) {
      expect(players.some((p) => p.id === captainId)).toBe(true);
    }
  });

  it("should select remaining captain if one already selected", () => {
    const { lobby, host, players } = setupLobby(5);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    randomCaptains(host);

    expect(lobby.captainsDraft?.captains).toHaveLength(2);
    expect(lobby.captainsDraft?.captains[0]).toBe("player-1");
    expect(lobby.captainsDraft?.phase).toBe("drafting");
  });

  it("should not allow non-host to random captains", () => {
    const { lobby, host, players } = setupLobby(5);
    startCaptains(host);

    randomCaptains(players[1]);

    expect(lobby.captainsDraft?.captains).toEqual([]);
  });
});

describe("captainPick", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should allow current captain to pick a player", () => {
    const { lobby, host, players } = setupLobby(7);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });
    mockMessages = [];

    // Captain 0 (host) picks first
    captainPick(players[0], { type: "captainPick", playerId: players[2].id });

    expect(lobby.captainsDraft?.picks[0]).toContain("player-2");
  });

  it("should not allow non-current captain to pick", () => {
    const { lobby, host, players } = setupLobby(5);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    // Captain 1 tries to pick when it's Captain 0's turn
    captainPick(players[1], { type: "captainPick", playerId: players[2].id });

    expect(lobby.captainsDraft?.picks[0]).toEqual([]);
    expect(lobby.captainsDraft?.picks[1]).toEqual([]);
  });

  it("should follow snake draft pattern (1-2-2-...)", () => {
    const { lobby, host, players } = setupLobby(8);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    // Captain 0 picks 1 (pool: 6)
    expect(lobby.captainsDraft?.currentPicker).toBe(0);
    expect(lobby.captainsDraft?.picksThisTurn).toBe(1);
    captainPick(players[0], { type: "captainPick", playerId: players[2].id });

    // Captain 1 picks 2 (pool: 5)
    expect(lobby.captainsDraft?.currentPicker).toBe(1);
    expect(lobby.captainsDraft?.picksThisTurn).toBe(2);
    captainPick(players[1], { type: "captainPick", playerId: players[3].id });

    // Captain 1 picks again (pool: 4)
    expect(lobby.captainsDraft?.currentPicker).toBe(1);
    expect(lobby.captainsDraft?.picksThisTurn).toBe(1);
    captainPick(players[1], { type: "captainPick", playerId: players[4].id });

    // Captain 0 picks 2 (pool: 3)
    expect(lobby.captainsDraft?.currentPicker).toBe(0);
    expect(lobby.captainsDraft?.picksThisTurn).toBe(2);
  });

  it("should complete draft and assign teams", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });
    mockMessages = [];

    // Captain 0 picks player-2
    captainPick(players[0], { type: "captainPick", playerId: players[2].id });

    // Only player-3 remains, auto-drafted to captain 1
    expect(lobby.captainsDraft?.phase).toBe("drafted");
    expect(lobby.status).toBe("lobby");

    // Check team assignments
    expect(players[0].team).toBe("sheep"); // Captain 0
    expect(players[2].team).toBe("sheep"); // Picked by captain 0
    expect(players[1].team).toBe("wolf"); // Captain 1
    expect(players[3].team).toBe("wolf"); // Auto-drafted to captain 1
  });

  it("should update sheep count setting after draft", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);
    selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
    selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

    captainPick(players[0], { type: "captainPick", playerId: players[2].id });

    // Sheep team has 2 players (captain + 1 pick)
    expect(lobby.settings.sheep).toBe(2);
  });
});

describe("cancelCaptains", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  it("should cancel captains draft", () => {
    const { lobby, host } = setupLobby(4);
    startCaptains(host);

    cancelCaptains(host);

    expect(lobby.status).toBe("lobby");
    expect(lobby.captainsDraft).toBeUndefined();
  });

  it("should not allow non-host to cancel", () => {
    const { lobby, host, players } = setupLobby(4);
    startCaptains(host);

    cancelCaptains(players[1]);

    expect(lobby.captainsDraft).toBeDefined();
  });
});

describe("handleCaptainsPlayerLeave", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  afterEach(() => {
    lobbyContext.current = undefined;
    clientContext.current = undefined;
  });

  describe("during captain selection", () => {
    it("should remove leaving player from captains list", () => {
      const { lobby, host, players } = setupLobby(5);
      startCaptains(host);
      selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

      // Player 1 leaves (was selected as captain)
      lobby.players.delete(players[1]);
      handleCaptainsPlayerLeave(lobby, players[1].id);

      expect(lobby.captainsDraft?.captains).toEqual([]);
      expect(lobby.captainsDraft?.phase).toBe("selecting-captains");
    });

    it("should continue if 3+ players remain after leave", () => {
      const { lobby, host, players } = setupLobby(5);
      startCaptains(host);

      // Player leaves (not selected as captain)
      lobby.players.delete(players[4]);
      handleCaptainsPlayerLeave(lobby, players[4].id);

      expect(lobby.captainsDraft?.phase).toBe("selecting-captains");
    });

    it("should cancel if fewer than 3 players remain", () => {
      const { lobby, host, players } = setupLobby(3);
      startCaptains(host);

      // One player leaves
      lobby.players.delete(players[2]);
      handleCaptainsPlayerLeave(lobby, players[2].id);

      expect(lobby.status).toBe("lobby");
      expect(lobby.captainsDraft).toBeUndefined();
    });
  });

  describe("during drafting", () => {
    it("should cancel if captain leaves", () => {
      const { lobby, host, players } = setupLobby(5);
      startCaptains(host);
      selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
      selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

      // Captain 0 (host) leaves
      lobby.players.delete(players[0]);
      handleCaptainsPlayerLeave(lobby, players[0].id);

      expect(lobby.status).toBe("lobby");
      expect(lobby.captainsDraft).toBeUndefined();
    });

    it("should cancel if drafted player leaves", () => {
      const { lobby, host, players } = setupLobby(6);
      startCaptains(host);
      selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
      selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });
      captainPick(players[0], { type: "captainPick", playerId: players[2].id });

      // Drafted player (player-2) leaves
      lobby.players.delete(players[2]);
      handleCaptainsPlayerLeave(lobby, players[2].id);

      expect(lobby.status).toBe("lobby");
      expect(lobby.captainsDraft).toBeUndefined();
    });

    it("should continue if undrafted player leaves", () => {
      const { lobby, host, players } = setupLobby(6);
      startCaptains(host);
      selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
      selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

      // Undrafted player leaves
      lobby.players.delete(players[5]);
      handleCaptainsPlayerLeave(lobby, players[5].id);

      expect(lobby.captainsDraft?.phase).toBe("drafting");
    });

    it("should auto-draft remaining players when undrafted player leaves and pool shrinks", () => {
      const { lobby, host, players } = setupLobby(6);
      startCaptains(host);
      selectCaptain(host, { type: "selectCaptain", playerId: players[0].id });
      selectCaptain(host, { type: "selectCaptain", playerId: players[1].id });

      // Captain 0 picks player-2
      captainPick(players[0], { type: "captainPick", playerId: players[2].id });

      // Now captain 1 has 2 picks, pool has players 3, 4, 5
      // Player 5 leaves, pool now has players 3, 4 (2 players, 2 picks)
      lobby.players.delete(players[5]);
      handleCaptainsPlayerLeave(lobby, players[5].id);

      // Should auto-draft players 3 and 4 to captain 1 and complete
      expect(lobby.captainsDraft?.phase).toBe("drafted");
      expect(lobby.status).toBe("lobby");
      expect(players[3].team).toBe("wolf");
      expect(players[4].team).toBe("wolf");
    });
  });
});
