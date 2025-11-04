import "global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, Entity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";
import { prefabs as _prefabs } from "@/shared/data.ts";
import {
  cancelBlueprint,
  createBlueprint,
  getBlueprint,
  hasBlueprint,
  normalize,
  updateBlueprint,
} from "./blueprintHandlers.ts";

describe("blueprint handlers", () => {
  beforeEach(() => {
    // Clear existing entities from app
    for (const entity of app.entities) app.removeEntity(entity);

    // Clear selection
    for (const entity of selection) delete (entity as Entity).selected;
  });

  afterEach(() => {
    cancelBlueprint();
  });

  describe("normalize", () => {
    it("should round to even steps when half", () => {
      expect(normalize(1.3, "half")).toBe(1.5);
      expect(normalize(1.7, "half")).toBe(1.5);
      expect(normalize(2.4, "half")).toBe(2.5);
    });

    it("should round to half steps when offset-half", () => {
      expect(normalize(1.3, "offset-half")).toBe(1.25);
      expect(normalize(1.7, "offset-half")).toBe(1.75);
      expect(normalize(2.4, "offset-half")).toBe(2.25);
    });

    it("should round to full half steps when offset-full", () => {
      expect(normalize(1.3, "offset-full")).toBe(1.5);
      expect(normalize(1.7, "offset-full")).toBe(1.5);
      expect(normalize(2.4, "offset-full")).toBe(2.5);
    });
  });

  describe("blueprint creation", () => {
    beforeEach(() => {
      // Add a builder unit that can build huts
      const builder = app.addEntity({
        id: "builder-1",
        prefab: "sheep",
        owner: "player-1",
        position: { x: 5, y: 5 },
        actions: [{
          type: "build" as const,
          name: "Build Hut",
          unitType: "hut",
          goldCost: 10,
          binding: ["KeyB"],
        }],
      });
      (builder as Entity).selected = true;
    });

    it("should create a blueprint when builder exists", () => {
      expect(hasBlueprint()).toBe(false);

      createBlueprint("hut", 10, 10);

      expect(hasBlueprint()).toBe(true);
      const blueprint = getBlueprint();
      expect(blueprint?.prefab).toBe("hut");
      expect(blueprint?.position?.x).toBe(10);
      expect(blueprint?.position?.y).toBe(10);
    });

    it("should not create blueprint without valid builder", () => {
      // Clear selection
      for (const entity of selection) delete (entity as Entity).selected;

      createBlueprint("hut", 10, 10);

      expect(hasBlueprint()).toBe(false);
    });

    it("should normalize blueprint position based on prefab size", () => {
      // Hut has width: 4, height: 4, both are divisible by 4, so both use evenStep = true
      createBlueprint("hut", 10.3, 10.7);

      const blueprint = getBlueprint();
      expect(blueprint?.position?.x).toBe(10.5); // normalized for even width (4 % 4 === 0)
      expect(blueprint?.position?.y).toBe(10.5); // normalized for even height (4 % 4 === 0)
    });
  });

  describe("blueprint updates", () => {
    beforeEach(() => {
      // Add a builder and create initial blueprint
      const builder = app.addEntity({
        id: "builder-1",
        prefab: "sheep",
        owner: "player-1",
        position: { x: 5, y: 5 },
        actions: [{
          type: "build" as const,
          name: "Build Hut",
          unitType: "hut",
          goldCost: 10,
          binding: ["KeyB"],
        }],
      });
      (builder as Entity).selected = true;

      createBlueprint("hut", 10, 10);
    });

    it("should update blueprint position", () => {
      updateBlueprint(15, 20);

      const blueprint = getBlueprint();
      expect(blueprint?.position?.x).toBe(15); // normalized based on hut dimensions (4x4, both evenStep=true)
      expect(blueprint?.position?.y).toBe(20); // normalized based on hut dimensions (4x4, both evenStep=true)
    });

    it("should not update without builder", () => {
      // Clear selection to remove builder
      for (const entity of selection) delete (entity as Entity).selected;

      const originalPos = getBlueprint()?.position;
      updateBlueprint(15, 20);

      const blueprint = getBlueprint();
      expect(blueprint?.position).toEqual(originalPos);
    });
  });

  describe("blueprint cancellation", () => {
    beforeEach(() => {
      // Add a builder and create initial blueprint
      const builder = app.addEntity({
        id: "builder-1",
        prefab: "sheep",
        owner: "player-1",
        position: { x: 5, y: 5 },
        actions: [{
          type: "build" as const,
          name: "Build Hut",
          unitType: "hut",
          goldCost: 10,
          binding: ["KeyB"],
        }],
      });
      (builder as Entity).selected = true;

      createBlueprint("hut", 10, 10);
    });

    it("should cancel blueprint", () => {
      expect(hasBlueprint()).toBe(true);

      cancelBlueprint();

      expect(hasBlueprint()).toBe(false);
      expect(getBlueprint()).toBeUndefined();
    });

    it("should handle cancellation when no blueprint exists", () => {
      cancelBlueprint();
      expect(hasBlueprint()).toBe(false);

      // Should not throw when cancelling again
      cancelBlueprint();
      expect(hasBlueprint()).toBe(false);
    });
  });
});
