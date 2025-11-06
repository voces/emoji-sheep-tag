import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { handlers } from "../messageHandlers.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import "./fog.ts";
import { expect } from "@std/expect/expect";
import { lookup } from "./lookup.ts";
import { mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { app } from "../ecs.ts";

it("switch wolf -> sheep", () => {
  handlers.join({
    type: "join",
    lobby: "Strong Spirit",
    status: "playing",
    updates: [
      { id: "player-0", isPlayer: true, team: "sheep" },
      { id: "player-1", isPlayer: true, team: "wolf" },
      mergeEntityWithPrefab({
        id: "sheep-0",
        prefab: "sheep",
        owner: "player-0",
        position: { x: 30, y: 30 },
      }),
      mergeEntityWithPrefab({
        id: "hut-0",
        prefab: "hut",
        owner: "player-0",
        position: { x: 35, y: 30 },
      }),
      mergeEntityWithPrefab({
        id: "wolf-0",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 20, y: 30 },
      }),
    ],
    lobbySettings: lobbySettingsVar(),
    localPlayer: "player-0",
  });
  app.update();

  expect(lookup["sheep-0"]!.hiddenByFog).toBeFalsy();
  expect(lookup["hut-0"]!.hiddenByFog).toBeFalsy();
  expect(lookup["wolf-0"]!.hiddenByFog).toBeTruthy();

  handlers.updates({
    type: "updates",
    updates: [
      { id: "sheep-0", __delete: true },
      { id: "player-1", team: "sheep" },
      { id: "wolf-0", __delete: true },
      mergeEntityWithPrefab({
        id: "sheep-1",
        prefab: "sheep",
        owner: "player-1",
        position: { x: 30, y: 30 },
      }),

      { id: "player-0", team: "wolf" },
      mergeEntityWithPrefab({
        id: "wolf-1",
        prefab: "wolf",
        owner: "player-0",
        position: { x: 20, y: 30 },
      }),
    ],
  });
  app.update();

  expect(lookup["sheep-1"]!.hiddenByFog).toBeFalsy(); // 10 < 14
  expect(lookup["hut-0"]!.hiddenByFog).toBeFalsy(); // ally
  expect(lookup["wolf-1"]!.hiddenByFog).toBeFalsy(); // ally
});
