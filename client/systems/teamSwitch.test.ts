import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, map } from "../ecs.ts";
import { visibilityGrid } from "./fog.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { getSheepPlayers, getWolfPlayers } from "@/shared/api/player.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";

it("should update fog when player team changes", () => {
  app.batch(() => {
    // Setup: Create three players - player3 is the local player (starts on wolf team)
    const player1Entity = addEntity({
      id: "player1",
      isPlayer: true,
      team: "sheep",
    });
    map["player1"] = player1Entity;

    const player2Entity = addEntity({
      id: "player2",
      isPlayer: true,
      team: "wolf",
    });
    map["player2"] = player2Entity;

    localPlayerIdVar("player3");
    const player3Entity = addEntity({
      id: "player3",
      isPlayer: true,
      team: "wolf",
    });
    map["player3"] = player3Entity;

    // Create a sheep unit (owned by player1, on sheep team)
    const sheep = addEntity({
      id: "sheep1",
      prefab: "sheep",
      owner: "player1",
      position: { x: 20, y: 20 },
      sightRadius: 6,
    });
    map["sheep1"] = sheep;

    // Create a wolf unit (owned by player2, on wolf team)
    const wolf = addEntity({
      id: "wolf1",
      prefab: "wolf",
      owner: "player2",
      position: { x: 60, y: 60 },
      sightRadius: 14,
    });
    map["wolf1"] = wolf;
  });

  app.update(); // Run one frame to initialize fog

  // Verify initial state: Local player is on wolf team
  // Should see wolf location (60, 60) - same team
  expect(visibilityGrid.isPositionVisible(20, 20)).toBeFalsy();
  expect(visibilityGrid.isPositionVisible(60, 60)).toBeTruthy();

  // Now switch local player's team from wolf to sheep
  app.batch(() => {
    const player3Entity = map["player3"];
    player3Entity.team = "sheep";
  });

  app.update(0.016, 0); // Run one frame to process changes

  // After team switch: Local player is now on sheep team
  // Should now see sheep location (20, 20) - now same team
  expect(visibilityGrid.isPositionVisible(20, 20)).toBeTruthy();
  // TODO: should not work!
  // expect(visibilityGrid.isPositionVisible(60, 60)).toBeFalsy();

  expect(getSheepPlayers()).toHaveLength(2);
  expect(getWolfPlayers()).toHaveLength(1);
});
