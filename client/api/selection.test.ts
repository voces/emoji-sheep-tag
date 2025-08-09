import "npm:global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { app, Entity, SystemEntity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { playersVar } from "@/vars/players.ts";

// We need to test the actual implementation, so we'll create test scenarios
// that work with the real getLocalPlayer function by setting up the player state

// Import the functions we want to test
import {
  clearSelection,
  selectAllMirrors,
  selectAllUnitsOfType,
  selectEntity,
  selectPrimaryUnit,
} from "./selection.ts";

describe("selection handlers", () => {
  beforeEach(() => {
    // Set up local player
    playersVar([{
      id: "player-1",
      name: "Test Player",
      color: "blue",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity-1", gold: 100 },
    }]);

    // Clear existing entities from app
    for (const entity of app.entities) app.removeEntity(entity);

    // Clear selection
    for (const entity of selection) delete (entity as Entity).selected;
  });

  afterEach(() => {
    clearSelection();
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
  });

  describe("selectAllUnitsOfType", () => {
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
    });

    it("should select all units of specified type owned by local player", () => {
      selectAllUnitsOfType("sheep");

      const selectedEntities = Array.from(selection);
      expect(selectedEntities).toHaveLength(2);
      expect(
        selectedEntities.every((e) =>
          e.prefab === "sheep" && e.owner === "player-1"
        ),
      ).toBe(true);
    });

    it("should not select units owned by other players", () => {
      selectAllUnitsOfType("sheep");

      const enemySheep = Array.from(app.entities).find((e) =>
        e.id === "sheep-enemy"
      );
      expect(enemySheep?.selected).toBeUndefined();
    });

    it("should clear previous selection", () => {
      const wolf = Array.from(app.entities).find((e) => e.prefab === "wolf");
      if (wolf) selectEntity(wolf);

      selectAllUnitsOfType("sheep");

      expect(wolf?.selected).toBeUndefined();
      expect(selection.size).toBe(2);
    });

    it("should handle when no units of type exist", () => {
      clearSelection(); // Ensure no previous selection
      selectAllUnitsOfType("nonexistent");

      expect(selection.size).toBe(0);
    });

    it("should handle when no units match type", () => {
      clearSelection(); // Ensure no previous selection
      selectAllUnitsOfType("dragon"); // Non-existent unit type

      expect(selection.size).toBe(0);
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
        prefab: "sheep",
        owner: "player-1",
        position: { x: 3, y: 3 },
      });
      app.addEntity({
        id: "enemy-mirror",
        prefab: "sheep",
        owner: "player-2",
        position: { x: 4, y: 4 },
        isMirror: true,
      });
    });

    it("should select all mirror units owned by local player", () => {
      selectAllMirrors();

      const selectedEntities = Array.from(selection);
      expect(selectedEntities).toHaveLength(2);
      expect(
        selectedEntities.every((e) =>
          e.isMirror === true && e.owner === "player-1"
        ),
      ).toBe(true);
    });

    it("should not select regular units", () => {
      selectAllMirrors();

      const regularUnit = Array.from(app.entities).find((e) =>
        e.id === "regular-unit"
      );
      expect(regularUnit?.selected).toBeUndefined();
    });

    it("should not select enemy mirror units", () => {
      selectAllMirrors();

      const enemyMirror = Array.from(app.entities).find((e) =>
        e.id === "enemy-mirror"
      );
      expect(enemyMirror?.selected).toBeUndefined();
    });

    it("should handle when no mirror units exist", () => {
      // Remove all mirrors
      for (const entity of app.entities) {
        if (entity.isMirror) app.removeEntity(entity);
      }

      selectAllMirrors();

      expect(selection.size).toBe(0);
    });
  });

  describe("selectPrimaryUnit", () => {
    beforeEach(() => {
      // Create various units including sheep and wolf
      app.addEntity({
        id: "sheep-1",
        prefab: "sheep",
        owner: "player-1",
        position: { x: 1, y: 1 },
      });
      app.addEntity({
        id: "wolf-1",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 2, y: 2 },
      });
      app.addEntity({
        id: "hut-1",
        prefab: "hut",
        owner: "player-1",
        position: { x: 3, y: 3 },
      });
      app.addEntity({
        id: "enemy-sheep",
        prefab: "sheep",
        owner: "player-2",
        position: { x: 4, y: 4 },
      });
    });

    it("should select first sheep owned by local player", () => {
      selectPrimaryUnit();

      const selectedEntities = Array.from(selection);
      expect(selectedEntities).toHaveLength(1);
      expect(selectedEntities[0].prefab).toBe("sheep");
      expect(selectedEntities[0].owner).toBe("player-1");
    });

    it("should select wolf if no sheep exists", () => {
      // Remove sheep
      const sheep = Array.from(app.entities).find((e) =>
        e.prefab === "sheep" && e.owner === "player-1"
      );
      if (sheep) app.removeEntity(sheep);

      selectPrimaryUnit();

      const selectedEntities = Array.from(selection);
      expect(selectedEntities).toHaveLength(1);
      expect(selectedEntities[0].prefab).toBe("wolf");
      expect(selectedEntities[0].owner).toBe("player-1");
    });

    it("should not select units owned by other players", () => {
      // Remove local player's sheep and wolf
      const playerUnits = Array.from(app.entities).filter((e) =>
        e.owner === "player-1" && (e.prefab === "sheep" || e.prefab === "wolf")
      );
      for (const unit of playerUnits) app.removeEntity(unit);

      selectPrimaryUnit();

      expect(selection.size).toBe(0);
      const enemySheep = Array.from(app.entities).find((e) =>
        e.id === "enemy-sheep"
      );
      expect(enemySheep?.selected).toBeUndefined();
    });

    it("should not select non-primary units like huts", () => {
      // Remove sheep and wolf, leaving only hut
      const primaryUnits = Array.from(app.entities).filter((e) =>
        e.owner === "player-1" && (e.prefab === "sheep" || e.prefab === "wolf")
      );
      for (const unit of primaryUnits) {
        app.removeEntity(unit);
      }

      selectPrimaryUnit();

      expect(selection.size).toBe(0);
      const hut = Array.from(app.entities).find((e) => e.id === "hut-1");
      expect(hut?.selected).toBeUndefined();
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
});
