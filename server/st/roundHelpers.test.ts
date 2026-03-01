import { afterEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { autoAssignSheepOrWolf, getIdealSheep } from "./roundHelpers.ts";
import { newLobby } from "../lobby.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";

afterEach(() => {
  lobbyContext.current = undefined;
});

describe("getIdealSheep", () => {
  it("returns correct values for N vs N+1 pattern", () => {
    // 1v3, 2v3, 2v4, 3v4, 3v5, 4v5, 4v6, etc.
    expect(getIdealSheep(4)).toBe(1); // 1v3
    expect(getIdealSheep(5)).toBe(2); // 2v3
    expect(getIdealSheep(6)).toBe(2); // 2v4
    expect(getIdealSheep(7)).toBe(3); // 3v4
    expect(getIdealSheep(8)).toBe(3); // 3v5
    expect(getIdealSheep(9)).toBe(4); // 4v5
    expect(getIdealSheep(10)).toBe(4); // 4v6
    expect(getIdealSheep(11)).toBe(5); // 5v6
    expect(getIdealSheep(12)).toBe(5); // 5v7
    expect(getIdealSheep(13)).toBe(6); // 6v7
  });

  it("returns at least 1 for small player counts", () => {
    expect(getIdealSheep(1)).toBe(1);
    expect(getIdealSheep(2)).toBe(1);
    expect(getIdealSheep(3)).toBe(1);
  });
});

describe("autoAssignSheepOrWolf", () => {
  it("assigns teams following N vs N+1 pattern when adding computers", () => {
    const lobby = newLobby();
    lobby.settings.sheep = "auto";

    // Create a host client as observer
    const observer = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    observer.id = "observer";
    observer.team = "observer";
    lobby.players.add(observer);

    lobbyContext.current = lobby;

    // Simulate adding 13 computers and track assignments
    const assignments: string[] = [];
    for (let i = 0; i < 13; i++) {
      const team = autoAssignSheepOrWolf(lobby, 1);
      assignments.push(team);

      // Simulate computer being added
      const fakeComputer = {
        id: `computer-${i}`,
        team,
        sheepCount: 0,
      };
      lobby.players.add(fakeComputer as Client);
    }

    // Expected pattern for N vs N+1:
    // 1: 1 player -> ideal 1 sheep, current 0 -> sheep
    // 2: 2 players -> ideal 1 sheep, current 1 -> wolf
    // 3: 3 players -> ideal 1 sheep, current 1 -> wolf
    // 4: 4 players -> ideal 1 sheep, current 1 -> wolf
    // 5: 5 players -> ideal 2 sheep, current 1 -> sheep
    // 6: 6 players -> ideal 2 sheep, current 2 -> wolf
    // 7: 7 players -> ideal 3 sheep, current 2 -> sheep
    // 8: 8 players -> ideal 3 sheep, current 3 -> wolf
    // 9: 9 players -> ideal 4 sheep, current 3 -> sheep
    // 10: 10 players -> ideal 4 sheep, current 4 -> wolf
    // 11: 11 players -> ideal 5 sheep, current 4 -> sheep
    // 12: 12 players -> ideal 5 sheep, current 5 -> wolf
    // 13: 13 players -> ideal 6 sheep, current 5 -> sheep

    expect(assignments).toEqual([
      "sheep", // 1v0
      "wolf", // 1v1
      "wolf", // 1v2
      "wolf", // 1v3
      "sheep", // 2v3
      "wolf", // 2v4
      "sheep", // 3v4
      "wolf", // 3v5
      "sheep", // 4v5
      "wolf", // 4v6
      "sheep", // 5v6
      "wolf", // 5v7
      "sheep", // 6v7
    ]);
  });

  it("ignores observers when counting players", () => {
    const lobby = newLobby();
    lobby.settings.sheep = "auto";

    // Add an observer
    const observer = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    observer.id = "observer";
    observer.team = "observer";
    lobby.players.add(observer);

    lobbyContext.current = lobby;

    // First computer should be sheep (1 player total, ignoring observer)
    const team = autoAssignSheepOrWolf(lobby, 1);
    expect(team).toBe("sheep");
  });

  it("assigns sheep first when host is wolf", () => {
    const lobby = newLobby();
    lobby.settings.sheep = "auto";

    // Add host as wolf
    const host = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    host.id = "host";
    host.team = "wolf";
    lobby.players.add(host);
    lobby.host = host;

    lobbyContext.current = lobby;

    // First computer should be sheep (we have 1 wolf, need 1 sheep for 2 players)
    const team = autoAssignSheepOrWolf(lobby, 1);
    expect(team).toBe("sheep");
  });
});
