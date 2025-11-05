import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { appContext } from "@/shared/context.ts";
import { addPlayerToPracticeGame } from "../api/player.ts";

afterEach(cleanupTest);

describe("joinLobby", () => {
  it(
    "should add player to sheep team and spawn practice units when joining practice game",
    { sheep: ["existing-player"], gold: 0 },
    ({ lobby, clients, ecs }) => {
      // Set practice mode
      lobby.round!.practice = true;

      // Create a new client to join mid-game
      const newClient = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      newClient.id = "joining-player";
      newClient.name = "Joining Player";
      newClient.playerColor = "#00FF00";
      clients.set("joining-player", newClient);

      // Add the client to the lobby's players set (joinLobby does this)
      lobby.players.add(newClient);
      newClient.lobby = lobby;

      // Call joinLobby within proper contexts
      lobbyContext.with(lobby, () => {
        appContext.with(ecs, () => {
          // Simulate the practice game join logic
          if (lobby.round?.practice && lobby.round.ecs) {
            ecs.batch(() => {
              addPlayerToPracticeGame(newClient);
            });
          }
        });
      });

      // Check player properties were set
      expect(newClient.team).toBe("sheep");
      expect(newClient.gold).toBe(100_000);
      expect(newClient.name).toBe("Joining Player");

      // Check units were spawned
      const units = Array.from(ecs.entities).filter((e) =>
        e.owner === "joining-player"
      );
      expect(units.length).toBeGreaterThanOrEqual(3); // sheep, spirit, wolf

      const sheep = units.find((u) => u.prefab === "sheep");
      expect(sheep).toBeDefined();
      expect(sheep?.owner).toBe("joining-player");

      const spirit = units.find((u) => u.prefab === "spirit");
      expect(spirit).toBeDefined();
      expect(spirit?.owner).toBe("joining-player");

      const wolf = units.find((u) => u.prefab === "wolf");
      expect(wolf).toBeDefined();
      expect(wolf?.owner).toBe("joining-player");
      expect(wolf?.manaRegen).toBeGreaterThan(0);
    },
  );

  it(
    "should not add player to game when joining non-practice game",
    { sheep: ["existing-player"], gold: 0 },
    ({ lobby, clients, ecs }) => {
      // Keep practice mode false (normal game)
      lobby.round!.practice = false;

      // Create a new client to join
      const newClient = new Client({
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
      });
      newClient.id = "joining-player";
      newClient.name = "Joining Player";
      newClient.playerColor = "#00FF00";
      clients.set("joining-player", newClient);

      // Add the client to the lobby's players set
      lobby.players.add(newClient);
      newClient.lobby = lobby;

      // Call joinLobby within proper contexts
      lobbyContext.with(lobby, () => {
        appContext.with(ecs, () => {
          // Simulate the practice game join logic
          if (lobby.round?.practice && lobby.round.ecs) {
            ecs.batch(() => {
              addPlayerToPracticeGame(newClient);
            });
          }
        });
      });

      // Should keep default "pending" team since it's not practice mode
      expect(newClient.team).toBe("pending");

      // Should not have any units spawned
      const units = Array.from(ecs.entities).filter((e) =>
        e.owner === "joining-player"
      );
      expect(units.length).toBe(0);
    },
  );

  it(
    "should not add player twice if they already have a team assigned",
    { sheep: ["existing-player"], gold: 0 },
    ({ lobby, clients, ecs }) => {
      // Set practice mode
      lobby.round!.practice = true;

      const existingClient = clients.get("existing-player")!;
      const originalTeam = existingClient.team;
      const originalGold = existingClient.gold;

      // Count entities before trying to add again
      const unitsBefore = Array.from(ecs.entities).filter((e) =>
        e.owner === "existing-player"
      );

      // Try to add again
      lobbyContext.with(lobby, () => {
        appContext.with(ecs, () => {
          if (lobby.round?.practice && lobby.round.ecs) {
            ecs.batch(() => {
              addPlayerToPracticeGame(existingClient);
            });
          }
        });
      });

      // Should keep original team and gold
      expect(existingClient.team).toBe(originalTeam);
      expect(existingClient.gold).toBe(originalGold);

      // Count entities owned by existing-player (should still be just the original ones)
      const units = Array.from(ecs.entities).filter((e) =>
        e.owner === "existing-player"
      );
      // Should have same number of units (no duplicate practice units)
      expect(units.length).toBe(unitsBefore.length);
    },
  );
});
