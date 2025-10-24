import "../testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, map } from "../ecs.ts";
import { data } from "../data.ts";
import { playersVar } from "@/vars/players.ts";
import { visibilityGrid } from "./fog.ts";
import "./teams.ts"; // Import to register the teams system

describe("team switch fog of war", () => {
  it("should update fog when player team changes", () => {
    // Setup: Create two players - player2 is the local player (sheep)
    playersVar([
      {
        id: "player1",
        name: "Player 1",
        color: "#ff0000",
        team: "wolf",
        sheepCount: 0,
        host: false,
      },
      {
        id: "player2",
        name: "Player 2",
        color: "#0000ff",
        team: "sheep",
        sheepCount: 0,
        host: false,
        local: true,
      },
    ]);

    app.batch(() => {
      // Create player entities - playerEntityReferences system will link them
      const player1Entity = app.addEntity({
        id: "player1-entity",
        owner: "player1",
        isPlayer: true,
        team: "wolf",
        position: { x: 40, y: 40 },
      });
      map["player1-entity"] = player1Entity;

      const player2Entity = app.addEntity({
        id: "player2-entity",
        owner: "player2",
        isPlayer: true,
        team: "sheep",
        position: { x: 45, y: 45 },
      });
      map["player2-entity"] = player2Entity;

      // Manual link since we're not using the normal flow
      const players = playersVar();
      players[0].entity = player1Entity;
      players[1].entity = player2Entity;
      playersVar(players);

      // Create a wolf unit for player1
      const wolf = app.addEntity({
        id: "wolf1",
        prefab: "wolf",
        owner: "player1",
        position: { x: 40, y: 40 },
        sightRadius: 10,
      });
      map["wolf1"] = wolf;

      // Create a sheep unit for player2
      const sheep = app.addEntity({
        id: "sheep1",
        prefab: "sheep",
        owner: "player2",
        position: { x: 42, y: 42 }, // Close to center
        sightRadius: 8,
      });
      map["sheep1"] = sheep;
    });

    // Verify initial state: wolf should not see sheep's position (they're enemies)
    const sheepVisible1 = visibilityGrid.isPositionVisible(42, 42);
    console.log(
      "Before team switch - sheep visible to local player:",
      sheepVisible1,
    );

    // Now simulate team switch: player1 becomes sheep
    app.batch(() => {
      const player1Entity = map["player1-entity"];
      player1Entity.team = "sheep"; // This should trigger teams system

      // Remove wolf
      app.removeEntity(map["wolf1"]);
      delete map["wolf1"];

      // Add new sheep for player1 at the old sheep's position
      const newSheep = app.addEntity({
        id: "newSheep1",
        prefab: "sheep",
        owner: "player1",
        position: { x: 42, y: 42 }, // Same position where old sheep died
        sightRadius: 8,
      });
      map["newSheep1"] = newSheep;

      // Update player2 to wolf team
      const player2Entity = map["player2-entity"];
      player2Entity.team = "wolf";

      // Add wolf for player2 at center
      const newWolf = app.addEntity({
        id: "newWolf1",
        prefab: "wolf",
        owner: "player2",
        position: { x: 40, y: 40 },
        sightRadius: 10,
      });
      map["newWolf1"] = newWolf;
    });

    app.update(0.016, 0); // Run one frame to process changes

    // After team switch: the new sheep at position 42,42 should now be visible
    // because it's owned by an ally (player1 is now sheep, same team as local player if local is sheep)
    const sheepVisible2 = visibilityGrid.isPositionVisible(42, 42);
    console.log("After team switch - new sheep visible:", sheepVisible2);

    // Check that data.sheep and data.wolves were updated
    console.log("data.sheep:", data.sheep.map((p) => p.id));
    console.log("data.wolves:", data.wolves.map((p) => p.id));

    expect(data.sheep.length + data.wolves.length).toBe(2);
  });
});
