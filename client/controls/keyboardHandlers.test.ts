import "global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import {
  checkShortcut,
  clearKeyboard,
  findActionForShortcut,
  handleKeyDown,
  handleKeyUp,
  isSameAction,
  keyboard,
  normalizedKeyboard,
} from "./keyboardHandlers.ts";

describe("keyboard handlers", () => {
  beforeEach(() => {
    // Clear existing entities from app
    for (const entity of app.entities) app.removeEntity(entity);

    // Clear selection
    for (const entity of selection) delete (entity as Entity).selected;

    // Clear keyboard state
    clearKeyboard();
  });

  afterEach(() => {
    clearKeyboard();
  });

  describe("keyboard state management", () => {
    it("should start with empty keyboard state", () => {
      expect(keyboard["KeyA"]).toBeUndefined();
      expect(normalizedKeyboard["a"]).toBeUndefined();
    });

    it("should have keyboard state functions", () => {
      expect(typeof handleKeyDown).toBe("function");
      expect(typeof handleKeyUp).toBe("function");
      expect(typeof clearKeyboard).toBe("function");
    });
  });

  describe("shortcut checking", () => {
    it("should have shortcut checking function", () => {
      expect(typeof checkShortcut).toBe("function");
    });

    it("should return boolean for basic shortcut checks", () => {
      const result = checkShortcut(["KeyA"], "KeyA");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("action comparison", () => {
    it("should identify same auto actions", () => {
      const action1 = { type: "auto" as const, order: "move", name: "Move" };
      const action2 = { type: "auto" as const, order: "move", name: "Move" };
      const action3 = {
        type: "auto" as const,
        order: "attack",
        name: "Attack",
      };

      expect(isSameAction(action1, action2)).toBe(true);
      expect(isSameAction(action1, action3)).toBe(false);
    });

    it("should identify same build actions", () => {
      const action1 = {
        type: "build" as const,
        unitType: "hut",
        name: "Build Hut",
      };
      const action2 = {
        type: "build" as const,
        unitType: "hut",
        name: "Build Hut",
      };
      const action3 = {
        type: "build" as const,
        unitType: "farm",
        name: "Build Farm",
      };

      expect(isSameAction(action1, action2)).toBe(true);
      expect(isSameAction(action1, action3)).toBe(false);
    });

    it("should identify same target actions", () => {
      const action1 = {
        type: "target" as const,
        order: "attack",
        name: "Attack",
        targeting: ["enemy" as const],
      };
      const action2 = {
        type: "target" as const,
        order: "attack",
        name: "Attack",
        targeting: ["enemy" as const],
      };
      const action3 = {
        type: "target" as const,
        order: "heal",
        name: "Heal",
        targeting: ["ally" as const],
      };

      expect(isSameAction(action1, action2)).toBe(true);
      expect(isSameAction(action1, action3)).toBe(false);
    });

    it("should identify same purchase actions", () => {
      const action1 = {
        type: "purchase" as const,
        itemId: "sword",
        name: "Buy Sword",
        goldCost: 100,
      };
      const action2 = {
        type: "purchase" as const,
        itemId: "sword",
        name: "Buy Sword",
        goldCost: 100,
      };
      const action3 = {
        type: "purchase" as const,
        itemId: "shield",
        name: "Buy Shield",
        goldCost: 50,
      };

      expect(isSameAction(action1, action2)).toBe(true);
      expect(isSameAction(action1, action3)).toBe(false);
    });

    it("should identify all menu actions as same", () => {
      const action1 = { type: "menu" as const, name: "Shop", actions: [] };
      const action2 = { type: "menu" as const, name: "Inventory", actions: [] };

      expect(isSameAction(action1, action2)).toBe(true);
    });
  });

  describe("action finding", () => {
    it("should have action finding function", () => {
      expect(typeof findActionForShortcut).toBe("function");
    });

    it("should return units and action objects", () => {
      const shortcuts = { sheep: {}, misc: {} };
      const mockEvent = { code: "KeyA" } as KeyboardEvent;

      const result = findActionForShortcut(mockEvent, shortcuts);

      expect(Array.isArray(result.units)).toBe(true);
      expect(result.action === undefined || typeof result.action === "object")
        .toBe(true);
    });
  });
});
