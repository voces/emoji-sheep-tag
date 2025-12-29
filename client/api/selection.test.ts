import "@/client-testing/setup.ts";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, Entity, SystemEntity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";

// We need to test the actual implementation, so we'll create test scenarios
// that work with the real getLocalPlayer function by setting up the player state

// Import the functions we want to test
import {
  clearSelection,
  DOUBLE_CLICK_SELECTION_RADIUS,
  selectAllFoxes,
  selectAllMirrors,
  selectEntitiesByPrefabInRadius,
  selectEntity,
  selectPrimaryUnit,
} from "./selection.ts";
import { camera } from "../graphics/three.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";

beforeEach(() => {
  addEntity({ id: "player-1", isPlayer: true, team: "sheep" });
  localPlayerIdVar("player-1");
});

describe("selectEntity", () => {
  it("should select a single entity", () => {
    const unit = app.addEntity({
      id: "unit-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 5, y: 5 },
    });

    selectEntity(unit);

    expect((unit as Entity).selected).toBe(true);
    expect(selection.has(unit as SystemEntity<"selected">)).toBe(true);
  });

  it("should clear previous selection by default", () => {
    const unit1 = app.addEntity({
      id: "unit-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 5, y: 5 },
    });
    const unit2 = app.addEntity({
      id: "unit-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 10, y: 10 },
    });

    selectEntity(unit1);
    expect((unit1 as Entity).selected).toBe(true);

    selectEntity(unit2);
    expect((unit1 as Entity).selected).toBeUndefined();
    expect((unit2 as Entity).selected).toBe(true);
  });

  it("should preserve selection when clearCurrentSelection is false", () => {
    const unit1 = app.addEntity({
      id: "unit-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 5, y: 5 },
    });
    const unit2 = app.addEntity({
      id: "unit-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 10, y: 10 },
    });

    selectEntity(unit1);
    selectEntity(unit2, false);

    expect((unit1 as Entity).selected).toBe(true);
    expect((unit2 as Entity).selected).toBe(true);
  });

  it("should toggle selection when toggle is true and entity is selected", () => {
    const unit1 = app.addEntity({
      id: "unit-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 5, y: 5 },
    });
    const unit2 = app.addEntity({
      id: "unit-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 10, y: 10 },
    });

    // Select both units
    selectEntity(unit1);
    selectEntity(unit2, false);
    expect((unit1 as Entity).selected).toBe(true);
    expect((unit2 as Entity).selected).toBe(true);

    // Toggle unit1 off
    selectEntity(unit1, false, true);
    expect((unit1 as Entity).selected).toBeUndefined();
    expect((unit2 as Entity).selected).toBe(true);

    // Toggle unit1 back on
    selectEntity(unit1, false, true);
    expect((unit1 as Entity).selected).toBe(true);
    expect((unit2 as Entity).selected).toBe(true);
  });
});

describe("selectEntitiesByPrefabInRadius", () => {
  it("should select nearby entities sharing the same prefab and owner", () => {
    const origin = addEntity({
      id: "sheep-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 0, y: 0 },
    });
    const inRange = addEntity({
      id: "sheep-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 3, y: 4 }, // distance 5
    });
    addEntity({
      id: "sheep-3",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 20, y: 20 }, // outside radius
    });
    addEntity({
      id: "sheep-enemy",
      prefab: "sheep",
      owner: "player-2",
      position: { x: 2, y: 2 },
    });
    addEntity({
      id: "wolf-1",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 1, y: 1 },
    });

    selectEntitiesByPrefabInRadius(
      origin,
      DOUBLE_CLICK_SELECTION_RADIUS,
      false,
    );

    const selectedIds = Array.from(selection, (e) => e.id);
    expect(selectedIds).toContain(origin.id);
    expect(selectedIds).toContain(inRange.id);
    expect(selectedIds).not.toContain("sheep-3");
    expect(selectedIds).not.toContain("sheep-enemy");
    expect(selectedIds).not.toContain("wolf-1");
  });

  it("should add to selection when additive flag is true", () => {
    // Create all entities first (sheep get auto-selected on creation)
    const origin = app.addEntity({
      id: "sheep-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 0, y: 0 },
    });
    const neighbor = app.addEntity({
      id: "sheep-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 2, y: 1 },
    });
    // Use a farm (doesn't auto-select) as the existing selection
    const existing = app.addEntity({
      id: "farm-existing",
      prefab: "farm",
      owner: "player-1",
      position: { x: 50, y: 50 },
    });
    selectEntity(existing, false); // Add to selection without clearing

    selectEntitiesByPrefabInRadius(
      origin,
      DOUBLE_CLICK_SELECTION_RADIUS,
      true,
    );

    const selectedIds = Array.from(selection, (e) => e.id);
    expect(selectedIds).toContain(existing.id);
    expect(selectedIds).toContain(origin.id);
    expect(selectedIds).toContain(neighbor.id);
  });

  it("should toggle selection when toggle flag is true", () => {
    const origin = app.addEntity({
      id: "sheep-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 0, y: 0 },
    });
    app.addEntity({
      id: "sheep-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 2, y: 1 },
    });
    app.addEntity({
      id: "sheep-3",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 1, y: 2 },
    });

    // Select all sheep
    selectEntitiesByPrefabInRadius(
      origin,
      DOUBLE_CLICK_SELECTION_RADIUS,
      false,
    );
    expect(selection.size).toBe(3);

    // Toggle them off (with additive=true and toggle=true)
    // Since some entities are selected, should deselect all
    selectEntitiesByPrefabInRadius(
      origin,
      DOUBLE_CLICK_SELECTION_RADIUS,
      true,
      true,
    );
    expect(selection.size).toBe(0);

    // Toggle them back on (no entities are selected, so should select all)
    selectEntitiesByPrefabInRadius(
      origin,
      DOUBLE_CLICK_SELECTION_RADIUS,
      true,
      true,
    );
    expect(selection.size).toBe(3);
  });
});

describe("selectAllFoxes", () => {
  beforeEach(() => {
    // Create various units
    app.addEntity({
      id: "sheep-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 1, y: 1 },
    });
    app.addEntity({
      id: "sheep-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 2, y: 2 },
    });
    app.addEntity({
      id: "wolf-1",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 3, y: 3 },
    });
    app.addEntity({
      id: "sheep-enemy",
      prefab: "sheep",
      owner: "player-2", // Different owner
      position: { x: 4, y: 4 },
    });
    app.addEntity({
      id: "fox-1",
      prefab: "fox",
      owner: "player-1",
      position: { x: 5, y: 5 },
    });
    app.addEntity({
      id: "fox-2",
      prefab: "fox",
      owner: "player-1",
      position: { x: 6, y: 6 },
    });
    app.addEntity({
      id: "fox-enemy",
      prefab: "fox",
      owner: "player-2",
      position: { x: 7, y: 7 },
    });
  });

  it("should select all foxes owned by local player", () => {
    selectAllFoxes();

    const selectedEntities = Array.from(selection);
    expect(selectedEntities).toHaveLength(2);
    expect(
      selectedEntities.every((e) =>
        e.prefab === "fox" && e.owner === "player-1"
      ),
    ).toBe(true);
  });

  it("should not select units owned by other players", () => {
    selectAllFoxes();

    const enemyFox = Array.from(app.entities).find((e) => e.id === "fox-enemy");
    expect(enemyFox?.selected).toBeUndefined();
  });

  it("should clear previous selection", () => {
    const wolf = Array.from(app.entities).find((e) => e.prefab === "wolf");
    if (wolf) selectEntity(wolf);

    selectAllFoxes();

    expect(wolf?.selected).toBeUndefined();
    expect(selection.size).toBe(2);
  });
});

describe("selectAllMirrors", () => {
  beforeEach(() => {
    // Create units with and without mirror property
    app.addEntity({
      id: "mirror-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 1, y: 1 },
      isMirror: true,
    });
    app.addEntity({
      id: "mirror-2",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 2, y: 2 },
      isMirror: true,
    });
    app.addEntity({
      id: "regular-unit",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 3, y: 3 },
    });
    app.addEntity({
      id: "enemy-mirror",
      prefab: "wolf",
      owner: "player-2",
      position: { x: 4, y: 4 },
      isMirror: true,
    });
  });

  it("should select wolf mirrors and move the camera on second selection", () => {
    selectAllMirrors();

    const selectedEntities = Array.from(selection);
    expect(selectedEntities).toHaveLength(1);
    expect(selectedEntities[0].id).toBe("mirror-2");
    // Camera moved to sheep on spawn
    expect(camera.position.x).toBe(1);
    expect(camera.position.y).toBe(1);

    selectAllMirrors();

    // Camera moved to fox on double select
    expect(camera.position.x).toBe(2);
    expect(camera.position.y).toBe(2);
  });
});

describe("selectPrimaryUnit", () => {
  it("should select sheep primary unit and move camera (with extra primary units)", () => {
    // Create sheep primary unit (first one) plus extra primary units
    // Note: sheep auto-selects and centers camera on creation
    app.addEntity({
      id: "sheep-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 10, y: 20 },
    });
    app.addEntity({
      id: "sheep-2",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 30, y: 40 },
    });
    app.addEntity({
      id: "wolf-1",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 50, y: 60 },
    });

    // Clear selection and set camera to a different position
    clearSelection();
    camera.position.x = 100;
    camera.position.y = 100;

    selectPrimaryUnit();

    // Should select first sheep (the primary unit)
    expect(Array.from(selection, (e) => e.id)).toEqual(["sheep-1"]);

    // selectPrimaryUnit only moves camera when unit was already selected
    // Since we cleared selection first, camera doesn't move on first call
    expect(camera.position.x).toBe(100);
    expect(camera.position.y).toBe(100);

    // Call selectPrimaryUnit again - now it should move camera
    selectPrimaryUnit();
    expect(camera.position.x).toBe(10);
    expect(camera.position.y).toBe(20);
  });

  it("should select wolf primary unit and move camera", () => {
    // Create wolf primary unit
    app.addEntity({
      id: "wolf-1",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 15, y: 25 },
    });

    // Set camera to a different position
    camera.position.x = 100;
    camera.position.y = 100;

    selectPrimaryUnit();

    // Should select the wolf
    expect(Array.from(selection, (e) => e.id)).toEqual(["wolf-1"]);

    // Camera should move to the wolf's position
    expect(camera.position.x).toBe(15);
    expect(camera.position.y).toBe(25);
  });

  it("should select spirit primary unit and move camera", () => {
    // Create spirit primary unit
    app.addEntity({
      id: "spirit-1",
      prefab: "spirit",
      owner: "player-1",
      position: { x: 35, y: 45 },
    });

    // Set camera to a different position
    camera.position.x = 100;
    camera.position.y = 100;

    selectPrimaryUnit();

    // Should select the spirit
    expect(Array.from(selection, (e) => e.id)).toEqual(["spirit-1"]);

    // Camera should move to the spirit's position
    expect(camera.position.x).toBe(35);
    expect(camera.position.y).toBe(45);
  });
});

describe("clearSelection", () => {
  beforeEach(() => {
    const unit1 = app.addEntity({
      id: "unit-1",
      prefab: "sheep",
      owner: "player-1",
      position: { x: 1, y: 1 },
    });
    const unit2 = app.addEntity({
      id: "unit-2",
      prefab: "wolf",
      owner: "player-1",
      position: { x: 2, y: 2 },
    });

    selectEntity(unit1, false);
    selectEntity(unit2, false);
  });

  it("should clear all selected entities", () => {
    expect(selection.size).toBe(2);

    clearSelection();

    expect(selection.size).toBe(0);
    for (const entity of app.entities) {
      expect((entity as Entity).selected).toBeUndefined();
    }
  });

  it("should handle empty selection gracefully", () => {
    clearSelection();
    expect(selection.size).toBe(0);

    // Should not throw when clearing again
    clearSelection();
    expect(selection.size).toBe(0);
  });
});
