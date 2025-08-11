import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { newEcs } from "../ecs.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newLobby } from "../lobby.ts";
import { getPlayerGold } from "../api/player.ts";
import { damageEntity, newUnit } from "../api/unit.ts";
import { interval } from "../api/timing.ts";
import { init } from "../st/data.ts";
// Import death system explicitly to ensure it's loaded
import "./death.ts";

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

describe("death system bounty integration", () => {
  it("should grant bounty when wolf kills hut", () => {
    setup();

    const wolfClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    wolfClient.id = "wolf-player";
    wolfClient.playerEntity = { id: "wolf-entity", gold: 10 };

    const sheepClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    sheepClient.id = "sheep-player";
    sheepClient.playerEntity = { id: "sheep-entity", gold: 5 };

    lobbyContext.context.round!.wolves.add(wolfClient);
    lobbyContext.context.round!.sheep.add(sheepClient);

    const wolf = newUnit("wolf-player", "wolf", 0, 0);
    const hut = newUnit("sheep-player", "hut", 5, 5);

    expect(getPlayerGold("wolf-player")).toBe(10);
    expect(hut.bounty).toBe(1);
    expect(hut.health).toBe(120);

    // Wolf damages the hut to death
    damageEntity(wolf, hut, 1000, true);

    expect(hut.health).toBe(0);
    expect(hut.lastAttacker).toBe(wolf.id);

    expect(getPlayerGold("wolf-player")).toBe(11);
  });

  it("should grant correct bounty amounts for different structures", () => {
    setup();

    const wolfClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    wolfClient.id = "wolf-player";
    wolfClient.playerEntity = { id: "wolf-entity", gold: 0 };

    const sheepClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    sheepClient.id = "sheep-player";
    sheepClient.playerEntity = { id: "sheep-entity", gold: 0 };

    lobbyContext.context.round!.wolves.add(wolfClient);
    lobbyContext.context.round!.sheep.add(sheepClient);

    const wolf = newUnit("wolf-player", "wolf", 0, 0);

    // Test different bounty amounts
    const wideHut = newUnit("sheep-player", "wideHut", 5, 5);
    expect(wideHut.bounty).toBe(3);
    damageEntity(wolf, wideHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(3);

    const rotundHut = newUnit("sheep-player", "rotundHut", 10, 10);
    expect(rotundHut.bounty).toBe(4);
    damageEntity(wolf, rotundHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(7);

    const translocationHut = newUnit(
      "sheep-player",
      "translocationHut",
      15,
      15,
    );
    expect(translocationHut.bounty).toBe(5);
    damageEntity(wolf, translocationHut, 1000, true);
    expect(getPlayerGold("wolf-player")).toBe(12);
  });
});
