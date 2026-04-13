import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { handlers } from "../messageHandlers.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import "./fog.ts";
import { expect } from "@std/expect/expect";
import { lookup } from "./lookup.ts";
import { mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { app } from "../ecs.ts";
import { visibilityGrid } from "./fog.ts";

describe("building sight radius at cliff edge", () => {
  // On the revo map, there's a cliff boundary at world x≈37.5-38.
  // West side (x<38) is height 2, east side (x>=38) is height 3.
  // A temple at (37.75, 61) straddles the boundary:
  //   - single terrain cell at position: height 2
  //   - getMaxEntityHeight across tilemap: height 3
  // The fog system should use the max height so the temple can see onto the cliff.
  const joinWithTemple = (templeX: number, templeY: number) => {
    handlers.join({
      type: "join",
      lobby: "test",
      status: "playing",
      updates: [
        { id: "player-0", isPlayer: true, team: "sheep" },
        mergeEntityWithPrefab({
          id: "sheep-0",
          prefab: "sheep",
          owner: "player-0",
          position: { x: 35, y: 61 },
        }),
        mergeEntityWithPrefab({
          id: "temple-0",
          prefab: "temple",
          owner: "player-0",
          position: { x: templeX, y: templeY },
        }),
      ],
      lobbySettings: lobbySettingsVar(),
      localPlayer: "player-0",
      captainsDraft: null,
    });
    app.update();
  };

  it("temple at cliff edge reveals cells on the cliff", () => {
    // Temple at (37.75, 61) straddles the cliff. sightRadius: 4.
    // Position (39, 61) is 1.25 units east, on the cliff (height 3).
    // With the fix, temple sees from height 3, so (39,61) should be visible.
    joinWithTemple(37.75, 61);

    expect(visibilityGrid.isVisible(39, 61)).toBe(true);
  });

  it("temple fully on low ground does not see onto cliff", () => {
    // Temple at (36, 61) is entirely on height 2 terrain.
    // Position (39, 61) at height 3 should NOT be visible.
    joinWithTemple(36, 61);

    expect(visibilityGrid.isVisible(39, 61)).toBe(false);
  });
});

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
    captainsDraft: null,
  });
  app.update();

  expect(lookup("sheep-0")!.hiddenByFog).toBeFalsy();
  expect(lookup("hut-0")!.hiddenByFog).toBeFalsy();
  expect(lookup("wolf-0")!.hiddenByFog).toBeTruthy();

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

  expect(lookup("sheep-1")!.hiddenByFog).toBeFalsy(); // 10 < 14
  expect(lookup("hut-0")!.hiddenByFog).toBeFalsy(); // ally
  expect(lookup("wolf-1")!.hiddenByFog).toBeFalsy(); // ally
});
