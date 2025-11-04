import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, map } from "./ecs.ts";
import {
  getPlayers,
  getSheepPlayers,
  getWolfPlayers,
} from "@/shared/api/player.ts";
import { getLocalPlayer } from "./api/player.ts";
import { stateVar } from "@/vars/state.ts";
import { handlers } from "./messageHandlers.ts";
import { chatLogVar } from "@/vars/chat.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { generateDoodads } from "@/shared/map.ts";

// Common test objects
const DEFAULT_LOBBY_SETTINGS = {
  mode: "survival" as const,
  vipHandicap: 0.8,
  sheep: 1,
  autoSheep: false,
  time: 300,
  autoTime: false,
  startingGold: { sheep: 25, wolves: 100 },
  income: { sheep: 1, wolves: 1 },
  host: null,
} as const;

const EMPTY_LOBBY_SETTINGS = {
  ...DEFAULT_LOBBY_SETTINGS,
  sheep: 0,
} as const;

// Helper functions
const createJoinMessage = (
  overrides: Partial<Parameters<typeof handlers.join>[0]> = {},
) => ({
  type: "join" as const,
  status: "lobby" as const,
  updates: [],
  lobbySettings: DEFAULT_LOBBY_SETTINGS,
  ...overrides,
});

const createLeaveMessage = (
  overrides: Partial<Parameters<typeof handlers.leave>[0]> = {},
) => ({
  type: "leave" as const,
  updates: [],
  lobbySettings: DEFAULT_LOBBY_SETTINGS,
  ...overrides,
});

describe("join", () => {
  it("initial join (first player)", () => {
    handlers.join(createJoinMessage({
      updates: [{ id: "player-0", isPlayer: true }],
      localPlayer: "player-0",
      lobbySettings: { ...DEFAULT_LOBBY_SETTINGS, host: "player-0" },
    }));

    expect(getPlayers().map((p) => p.id)).toEqual(["player-0"]);
    expect(getLocalPlayer()?.id).toBe("player-0");
    expect(lobbySettingsVar()?.host).toBe("player-0");
    expect(chatLogVar()).toHaveLength(0);
  });

  it("initial join (as second player)", () => {
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-0",
        isPlayer: true,
        name: "Player 0",
        playerColor: "#FF0000",
      }, {
        id: "player-1",
        isPlayer: true,
        name: "Player 1",
        playerColor: "#00FF00",
      }],
      localPlayer: "player-1",
    }));

    expect(getPlayers()).toHaveLength(2);
    expect(getPlayers().map((p) => p.id)).toEqual(["player-0", "player-1"]);
    expect(getLocalPlayer()?.id).toBe("player-1");
    expect(lobbySettingsVar()).toEqual(DEFAULT_LOBBY_SETTINGS);
    expect(chatLogVar()).toHaveLength(1);
    expect(chatLogVar()[0].message).toContain("Player 0");
    expect(chatLogVar()[0].message).toContain("joined");
  });

  it("another player joins our existing lobby", () => {
    // Setup existing lobby with us as first player
    handlers.join(createJoinMessage({
      updates: [{
        id: "existing-player",
        isPlayer: true,
      }],
      localPlayer: "existing-player",
    }));

    // Another player joins
    handlers.join(createJoinMessage({
      updates: [{
        id: "new-player",
        isPlayer: true,
        name: "Newcomer",
        playerColor: "#00FF00",
      }],
    }));

    expect(getPlayers()).toHaveLength(2);
    expect(getPlayers().map((p) => p.id)).toEqual([
      "existing-player",
      "new-player",
    ]);
    expect(chatLogVar()).toHaveLength(1);
    expect(chatLogVar()[0].message).toContain("Newcomer");
  });

  it("single player update (already known)", () => {
    // Setup initial lobby
    handlers.join(createJoinMessage({
      updates: [{
        id: "existing-player",
        isPlayer: true,
      }],
    }));

    const initialChatCount = chatLogVar().length;

    // Try to join the same player again
    handlers.join(createJoinMessage({
      updates: [{
        id: "existing-player",
        isPlayer: true,
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(getPlayers()).toHaveLength(1);
    expect(chatLogVar()).toHaveLength(initialChatCount);
  });
});

describe("colorChange via updates", () => {
  it("updates player color", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        name: "Test Player",
        playerColor: "#FF0000",
      }],
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "player-1",
        playerColor: "#00FF00",
      }],
    });

    expect(getPlayers()[0].playerColor).toBe("#00FF00");
    expect(getPlayers()[0].name).toBe("Test Player");
  });

  it("ignores unknown player", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        playerColor: "#FF0000",
      }],
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "unknown-player",
        playerColor: "#00FF00",
      }],
    });

    expect(getPlayers()[0].playerColor).toBe("#FF0000");
  });
});

describe("nameChange via updates", () => {
  it("updates player name", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        name: "Old Name",
        playerColor: "#FF0000",
      }],
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "player-1",
        name: "New Name",
      }],
    });

    expect(getPlayers()[0].name).toBe("New Name");
    expect(getPlayers()[0].playerColor).toBe("#FF0000");
  });

  it("ignores unknown player", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        name: "Test Player",
      }],
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "unknown-player",
        name: "New Name",
      }],
    });

    expect(getPlayers()[0].name).toBe("Test Player");
  });
});

describe("start", () => {
  it("transitions to playing state and sets up game", () => {
    // Setup players in lobby first
    handlers.join(createJoinMessage({
      updates: [{
        id: "sheep-1",
        isPlayer: true,
        team: "sheep",
      }, {
        id: "wolf-1",
        isPlayer: true,
        team: "wolf",
      }],
    }));

    handlers.start({
      type: "start",
      updates: [{ id: "sheep-1", sheepCount: 3 }, {
        id: "wolf-1",
      }],
    });

    expect(stateVar()).toBe("playing");
    expect(getPlayers().find((p) => p.id === "sheep-1")?.sheepCount).toBe(3);
    expect(getSheepPlayers().map((p) => p.id)).toEqual(["sheep-1"]);
    expect(getWolfPlayers().map((p) => p.id)).toEqual(["wolf-1"]);
  });

  it("handles players not in sheep or wolves lists", () => {
    // Setup observer player
    handlers.join(createJoinMessage({
      updates: [{
        id: "observer",
        isPlayer: true,
        team: "observer",
      }],
    }));

    handlers.start({ type: "start" });

    expect(getSheepPlayers()).toHaveLength(0);
    expect(getWolfPlayers()).toHaveLength(0);
    expect(stateVar()).toBe("playing");
  });
});

describe("stop", () => {
  it("returns to lobby and clears entities", () => {
    generateDoodads();
    const defaultCount = app.entities.size;

    // Setup game state first
    handlers.join(createJoinMessage({
      status: "playing",
      updates: [{
        id: "test-entity",
        prefab: "sheep",
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(stateVar()).toBe("playing");
    expect(Object.keys(map)).toContain("test-entity");
    expect(app.entities.size).toBe(defaultCount + 1);

    handlers.stop({
      type: "stop",
    });

    expect(stateVar()).toBe("lobby");
    expect(app.entities.size).toBe(defaultCount);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("updates players when provided", () => {
    // Setup player with sheep count
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        sheepCount: 5,
      }],
    }));

    handlers.stop({
      type: "stop",
      updates: [{
        id: "player-1",
        sheepCount: 0,
      }],
    });

    expect(getPlayers()[0].sheepCount).toBe(0);
  });

  it("appends rounds when provided", () => {
    // Setup existing rounds through join
    handlers.join(createJoinMessage({
      rounds: [{
        sheep: ["old-sheep"],
        wolves: ["old-wolf"],
        duration: 30000,
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    handlers.stop({
      type: "stop",
      round: {
        sheep: ["sheep-1"],
        wolves: ["wolf-1"],
        duration: 60000,
      },
    });

    expect(roundsVar()).toHaveLength(2);
    expect(roundsVar()[0].duration).toBe(30000);
    expect(roundsVar()[1].duration).toBe(60000);
    expect(roundsVar()[1].sheep).toEqual(["sheep-1"]);
    expect(roundsVar()[1].wolves).toEqual(["wolf-1"]);
  });
});

describe("updates", () => {
  it("creates new unit entity", () => {
    // Must be in playing state for unit updates
    handlers.join(createJoinMessage({
      status: "playing",
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "unit-1",
        prefab: "sheep",
        position: { x: 10, y: 20 },
        health: 100,
      }],
    });

    expect(Object.keys(map)).toContain("unit-1");
    expect(map["unit-1"].prefab).toBe("sheep");
    expect(map["unit-1"].position?.x).toBe(10);
    expect(map["unit-1"].health).toBe(100);
  });

  it("updates existing unit entity", () => {
    // Setup playing state with initial entity
    handlers.join(createJoinMessage({
      status: "playing",
      updates: [{
        id: "unit-1",
        prefab: "sheep",
        health: 100,
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    handlers.updates({
      type: "updates",
      updates: [{
        id: "unit-1",
        health: 50,
        position: { x: 15, y: 25 },
      }],
    });

    expect(map["unit-1"].health).toBe(50);
    expect(map["unit-1"].position?.x).toBe(15);
    expect(map["unit-1"].prefab).toBe("sheep");
  });

  it("deletes unit entity", () => {
    // Setup playing state with entity
    handlers.join(createJoinMessage({
      status: "playing",
      updates: [{
        id: "unit-1",
        prefab: "sheep",
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(map["unit-1"]).toBeDefined();

    handlers.updates({
      type: "updates",
      updates: [{
        id: "unit-1",
        __delete: true,
      }],
    });

    expect(map["unit-1"]).toBeUndefined();
  });

  it("processes multiple updates atomically", () => {
    // Setup playing state with initial entity
    handlers.join(createJoinMessage({
      status: "playing",
      updates: [{
        id: "unit-1",
        prefab: "sheep",
        health: 100,
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    handlers.updates({
      type: "updates",
      updates: [
        {
          id: "unit-1",
          health: 50,
          __delete: true,
        },
        {
          id: "unit-2",
          prefab: "wolf",
          health: 80,
        },
      ],
    });

    expect(map["unit-1"]).toBeUndefined();
    expect(map["unit-2"]).toBeDefined();
    expect(map["unit-2"].prefab).toBe("wolf");
    expect(map["unit-2"].health).toBe(80);
  });

  it("ignores updates when not in playing state", () => {
    // Stay in lobby state (no join with playing status)
    handlers.updates({
      type: "updates",
      updates: [{
        id: "unit-1",
        prefab: "sheep",
      }],
    });

    expect(Object.keys(map)).not.toContain("unit-1");
  });
});

describe("leave", () => {
  it("removes player and updates format", () => {
    // Setup players first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
      }, {
        id: "player-2",
        isPlayer: true,
      }],
    }));

    handlers.leave(createLeaveMessage({
      updates: [{ id: "player-1", __delete: true }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(getPlayers()).toHaveLength(1);
    expect(getPlayers()[0].id).toBe("player-2");
  });

  it("transfers host to another player", () => {
    // Setup players with host
    handlers.join(createJoinMessage({
      updates: [{
        id: "host",
        isPlayer: true,
      }, {
        id: "player-2",
        isPlayer: true,
      }],
      lobbySettings: { ...DEFAULT_LOBBY_SETTINGS, host: "host" },
    }));

    handlers.leave(createLeaveMessage({
      updates: [{ id: "host", __delete: true }],
      lobbySettings: { ...EMPTY_LOBBY_SETTINGS, host: "player-2" },
    }));

    expect(getPlayers()).toHaveLength(1);
    expect(getPlayers()[0].id).toBe("player-2");
    expect(lobbySettingsVar().host).toBe("player-2");
  });

  it("handles unknown player leaving", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
      }],
    }));

    handlers.leave(createLeaveMessage({
      updates: [{ id: "unknown-player", __delete: true }],
    }));

    expect(getPlayers()).toHaveLength(1);
  });
});

describe("chat", () => {
  it("adds player chat message with color", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      updates: [{
        id: "player-1",
        isPlayer: true,
        name: "Test Player",
        playerColor: "#FF0000",
      }],
    }));

    const initialChatCount = chatLogVar().length;

    handlers.chat({
      type: "chat",
      player: "player-1",
      message: "Hello world!",
    });

    expect(chatLogVar()).toHaveLength(initialChatCount + 1);
    expect(chatLogVar()[chatLogVar().length - 1].message).toBe(
      "|c#FF0000|Test Player|: Hello world!",
    );
  });

  it("adds server message for unknown player", () => {
    const initialChatCount = chatLogVar().length;

    handlers.chat({
      type: "chat",
      player: "unknown-player",
      message: "Server message",
    });

    expect(chatLogVar()).toHaveLength(initialChatCount + 1);
    expect(chatLogVar()[chatLogVar().length - 1].message).toBe(
      "Server message",
    );
  });
});

describe("lobbySettings", () => {
  it("updates lobby settings", () => {
    handlers.lobbySettings({
      type: "lobbySettings",
      mode: "survival",
      vipHandicap: 0.8,
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 50, wolves: 75 },
      income: { sheep: 1, wolves: 1 },
      host: null,
    });

    expect(lobbySettingsVar().startingGold).toEqual({ sheep: 50, wolves: 75 });
    expect(lobbySettingsVar().time).toBe(300);
    expect(lobbySettingsVar().autoTime).toBe(false);
  });

  it("overwrites existing settings", () => {
    handlers.lobbySettings({
      type: "lobbySettings",
      mode: "survival",
      vipHandicap: 0.8,
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 25, wolves: 100 },
      income: { sheep: 1, wolves: 1 },
      host: "player-1",
    });

    handlers.lobbySettings({
      type: "lobbySettings",
      mode: "vip",
      vipHandicap: 0.5,
      sheep: 3,
      autoSheep: true,
      time: 400,
      autoTime: true,
      startingGold: { sheep: 75, wolves: 50 },
      income: { sheep: 1, wolves: 1 },
      host: "player-2",
    });

    expect(lobbySettingsVar().startingGold).toEqual({ sheep: 75, wolves: 50 });
    expect(lobbySettingsVar().time).toBe(400);
    expect(lobbySettingsVar().autoTime).toBe(true);
    expect(lobbySettingsVar().host).toBe("player-2");
  });
});
