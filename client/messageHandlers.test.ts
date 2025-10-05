import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, map } from "./ecs.ts";
import { getLocalPlayer, playersVar } from "@/vars/players.ts";
import { stateVar } from "@/vars/state.ts";
import { data } from "./data.ts";
import { handlers } from "./messageHandlers.ts";
import { chatLogVar } from "@/vars/chat.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { generateDoodads } from "@/shared/map.ts";

// Common test objects
const DEFAULT_LOBBY_SETTINGS = {
  sheep: 1,
  autoSheep: false,
  time: 300,
  autoTime: false,
  startingGold: { sheep: 25, wolves: 100 },
  income: { sheep: 1, wolves: 1 },
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
  players: [],
  updates: [],
  lobbySettings: DEFAULT_LOBBY_SETTINGS,
  ...overrides,
});

const createLeaveMessage = (
  player: string,
  overrides: Partial<Parameters<typeof handlers.leave>[0]> = {},
) => ({
  type: "leave" as const,
  player,
  lobbySettings: DEFAULT_LOBBY_SETTINGS,
  ...overrides,
});

describe("join", () => {
  it("initial join (first player)", () => {
    handlers.join(createJoinMessage({
      players: [{
        id: "player-0",
        name: "Player 0",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
        local: true,
        host: true,
      }],
    }));

    expect(playersVar()).toHaveLength(1);
    expect(playersVar()[0].id).toBe("player-0");
    expect(playersVar()[0].local).toBe(true);
    expect(playersVar()[0].host).toBe(true);
    expect(getLocalPlayer()?.id).toBe("player-0");
    expect(chatLogVar()).toHaveLength(0);
  });

  it("initial join (as second player)", () => {
    handlers.join(createJoinMessage({
      players: [{
        id: "player-0",
        name: "Player 0",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
        host: true,
      }, {
        id: "player-1",
        name: "Player 1",
        color: "#00FF00",
        team: "wolf",
        sheepCount: 0,
        local: true,
      }],
    }));

    expect(playersVar()).toHaveLength(2);
    expect(playersVar().map((p) => p.id)).toEqual(["player-0", "player-1"]);
    expect(getLocalPlayer()?.id).toBe("player-1");
    expect(lobbySettingsVar()).toEqual(DEFAULT_LOBBY_SETTINGS);
    expect(chatLogVar()).toHaveLength(1);
    expect(chatLogVar()[0].message).toContain("Player 0");
    expect(chatLogVar()[0].message).toContain("joined");
  });

  it("another player joins our existing lobby", () => {
    // Setup existing lobby with us as first player
    handlers.join(createJoinMessage({
      players: [{
        id: "existing-player",
        name: "Existing",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
        local: true,
      }],
    }));

    // Another player joins
    handlers.join(createJoinMessage({
      players: [{
        id: "new-player",
        name: "Newcomer",
        color: "#00FF00",
        team: "wolf",
        sheepCount: 0,
      }],
    }));

    expect(playersVar()).toHaveLength(2);
    expect(playersVar().map((p) => p.id)).toEqual([
      "existing-player",
      "new-player",
    ]);
    expect(chatLogVar()).toHaveLength(1);
    expect(chatLogVar()[0].message).toContain("Newcomer");
  });

  it("single player update (already known)", () => {
    // Setup initial lobby
    handlers.join(createJoinMessage({
      players: [{
        id: "existing-player",
        name: "Existing",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
    }));

    const initialChatCount = chatLogVar().length;

    // Try to join the same player again
    handlers.join(createJoinMessage({
      players: [{
        id: "existing-player",
        name: "Existing Updated",
        color: "#0000FF",
        team: "wolf",
        sheepCount: 5,
      }],
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(playersVar()).toHaveLength(1);
    expect(playersVar()[0].name).toBe("Existing");
    expect(chatLogVar()).toHaveLength(initialChatCount);
  });
});

describe("colorChange", () => {
  it("updates player color", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      players: [{
        id: "player-1",
        name: "Test Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
    }));

    handlers.colorChange({
      type: "colorChange",
      id: "player-1",
      color: "#00FF00",
    });

    expect(playersVar()[0].color).toBe("#00FF00");
    expect(playersVar()[0].name).toBe("Test Player");
  });

  it("ignores unknown player", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      players: [{
        id: "player-1",
        name: "Test Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
    }));

    handlers.colorChange({
      type: "colorChange",
      id: "unknown-player",
      color: "#00FF00",
    });

    expect(playersVar()[0].color).toBe("#FF0000");
  });
});

describe("nameChange", () => {
  it("updates player name", () => {
    // Setup player first
    handlers.join({
      type: "join",
      status: "lobby",
      players: [{
        id: "player-1",
        name: "Old Name",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
      updates: [],
      lobbySettings: {
        sheep: 1,
        autoSheep: false,
        time: 300,
        autoTime: false,
        startingGold: { sheep: 25, wolves: 100 },
        income: { sheep: 1, wolves: 1 },
      },
    });

    handlers.nameChange({
      type: "nameChange",
      id: "player-1",
      name: "New Name",
    });

    expect(playersVar()[0].name).toBe("New Name");
    expect(playersVar()[0].color).toBe("#FF0000");
  });

  it("ignores unknown player", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      players: [{
        id: "player-1",
        name: "Test Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
    }));

    handlers.nameChange({
      type: "nameChange",
      id: "unknown-player",
      name: "New Name",
    });

    expect(playersVar()[0].name).toBe("Test Player");
  });
});

describe("start", () => {
  it("transitions to playing state and sets up game", () => {
    // Setup players in lobby first
    handlers.join(createJoinMessage({
      players: [{
        id: "sheep-1",
        name: "Sheep Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }, {
        id: "wolf-1",
        name: "Wolf Player",
        color: "#00FF00",
        team: "wolf",
        sheepCount: 0,
      }],
    }));

    handlers.start({
      type: "start",
      sheep: [{ id: "sheep-1", sheepCount: 3 }],
      wolves: ["wolf-1"],
    });

    expect(stateVar()).toBe("playing");
    expect(playersVar().find((p) => p.id === "sheep-1")?.sheepCount).toBe(3);
    expect(data.sheep).toHaveLength(1);
    expect(data.sheep[0].id).toBe("sheep-1");
    expect(data.wolves).toHaveLength(1);
    expect(data.wolves[0].id).toBe("wolf-1");
  });

  it("handles players not in sheep or wolves lists", () => {
    // Setup observer player
    handlers.join(createJoinMessage({
      players: [{
        id: "observer",
        name: "Observer",
        color: "#CCCCCC",
        team: "observer",
        sheepCount: 0,
      }],
    }));

    handlers.start({
      type: "start",
      sheep: [],
      wolves: [],
    });

    expect(data.sheep).toHaveLength(0);
    expect(data.wolves).toHaveLength(0);
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
    handlers.join({
      type: "join",
      status: "lobby",
      players: [{
        id: "player-1",
        name: "Test",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 5,
      }],
      updates: [],
      lobbySettings: {
        sheep: 1,
        autoSheep: false,
        time: 300,
        autoTime: false,
        startingGold: { sheep: 25, wolves: 100 },
        income: { sheep: 1, wolves: 1 },
      },
    });

    handlers.stop({
      type: "stop",
      players: [{
        id: "player-1",
        sheepCount: 0,
      }],
    });

    expect(playersVar()[0].sheepCount).toBe(0);
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
    handlers.join({
      type: "join",
      status: "playing",
      players: [],
      updates: [],
      lobbySettings: {
        sheep: 0,
        autoSheep: true,
        time: 300,
        autoTime: false,
        startingGold: { sheep: 25, wolves: 100 },
        income: { sheep: 1, wolves: 1 },
      },
    });

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
    handlers.join({
      type: "join",
      status: "lobby",
      players: [{
        id: "player-1",
        name: "Leaving Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }, {
        id: "player-2",
        name: "Staying Player",
        color: "#00FF00",
        team: "wolf",
        sheepCount: 0,
      }],
      updates: [],
      lobbySettings: {
        sheep: 1,
        autoSheep: false,
        time: 300,
        autoTime: false,
        startingGold: { sheep: 25, wolves: 100 },
        income: { sheep: 1, wolves: 1 },
      },
    });

    const initialChatCount = chatLogVar().length;

    handlers.leave(createLeaveMessage("player-1", {
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(playersVar()).toHaveLength(1);
    expect(playersVar()[0].id).toBe("player-2");
    expect(chatLogVar()).toHaveLength(initialChatCount + 1);
    expect(chatLogVar()[chatLogVar().length - 1].message).toContain(
      "Leaving Player",
    );
    expect(chatLogVar()[chatLogVar().length - 1].message).toContain("left");
  });

  it("transfers host to another player", () => {
    // Setup players with host
    handlers.join({
      type: "join",
      status: "lobby",
      players: [{
        id: "host",
        name: "Host Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
        host: true,
      }, {
        id: "player-2",
        name: "Regular Player",
        color: "#00FF00",
        team: "wolf",
        sheepCount: 0,
      }],
      updates: [],
      lobbySettings: {
        sheep: 1,
        autoSheep: false,
        time: 300,
        autoTime: false,
        startingGold: { sheep: 25, wolves: 100 },
        income: { sheep: 1, wolves: 1 },
      },
    });

    handlers.leave(createLeaveMessage("host", {
      host: "player-2",
      lobbySettings: EMPTY_LOBBY_SETTINGS,
    }));

    expect(playersVar()).toHaveLength(1);
    expect(playersVar()[0].id).toBe("player-2");
    expect(playersVar()[0].host).toBe(true);
  });

  it("handles unknown player leaving", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      players: [{
        id: "player-1",
        name: "Test Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
      }],
    }));

    const initialChatCount = chatLogVar().length;

    handlers.leave(createLeaveMessage("unknown-player"));

    expect(playersVar()).toHaveLength(1);
    expect(chatLogVar()).toHaveLength(initialChatCount);
  });
});

describe("chat", () => {
  it("adds player chat message with color", () => {
    // Setup player first
    handlers.join(createJoinMessage({
      players: [{
        id: "player-1",
        name: "Test Player",
        color: "#FF0000",
        team: "sheep",
        sheepCount: 0,
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
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 50, wolves: 75 },
      income: { sheep: 1, wolves: 1 },
    });

    expect(lobbySettingsVar().startingGold).toEqual({ sheep: 50, wolves: 75 });
    expect(lobbySettingsVar().time).toBe(300);
    expect(lobbySettingsVar().autoTime).toBe(false);
  });

  it("overwrites existing settings", () => {
    handlers.lobbySettings({
      type: "lobbySettings",
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 25, wolves: 100 },
      income: { sheep: 1, wolves: 1 },
    });

    handlers.lobbySettings({
      type: "lobbySettings",
      sheep: 3,
      autoSheep: true,
      time: 400,
      autoTime: true,
      startingGold: { sheep: 75, wolves: 50 },
      income: { sheep: 1, wolves: 1 },
    });

    expect(lobbySettingsVar().startingGold).toEqual({ sheep: 75, wolves: 50 });
    expect(lobbySettingsVar().time).toBe(400);
    expect(lobbySettingsVar().autoTime).toBe(true);
  });
});
