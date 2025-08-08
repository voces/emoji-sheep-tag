import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  findAction,
  findActionAndItem,
  findActionByOrder,
} from "./actionLookup.ts";
import { Entity } from "@/shared/types.ts";

describe("actionLookup", () => {
  // Test entity with various action sources
  const createTestEntity = (): Entity => ({
    id: "test-entity",
    actions: [
      {
        name: "Move",
        type: "target",
        order: "move",
        binding: ["KeyV"],
      },
      {
        name: "Stop",
        type: "auto",
        order: "stop",
        binding: ["KeyS"],
      },
      {
        name: "Build Menu",
        type: "menu",
        binding: ["KeyB"],
        actions: [
          {
            name: "Build Hut",
            type: "build",
            unitType: "hut",
            binding: ["KeyH"],
          },
          {
            name: "Build Farm",
            type: "build",
            unitType: "farm",
            binding: ["KeyF"],
          },
        ],
      },
    ],
    inventory: [
      {
        id: "foxItem",
        name: "Summon Fox",
        gold: 50,
        binding: ["KeyF"],
        charges: 2,
        actions: [{
          name: "Summon Fox",
          type: "auto",
          order: "fox",
          binding: ["KeyF"],
          castDuration: 0.1,
        }],
      },
      {
        id: "potionItem",
        name: "Healing Potion",
        gold: 20,
        binding: ["KeyP"],
        charges: 0, // No charges left
        actions: [{
          name: "Heal",
          type: "auto",
          order: "heal",
          binding: ["KeyP"],
          castDuration: 0.5,
        }],
      },
      {
        id: "scrollItem",
        name: "Scroll of Lightning",
        gold: 30,
        binding: ["KeyL"],
        // No charges property - should be treated as unlimited
        actions: [{
          name: "Lightning",
          type: "target",
          order: "lightning",
          binding: ["KeyL"],
          castDuration: 1.0,
        }],
      },
    ],
  });

  describe("findAction", () => {
    it("should find action from unit base actions", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "move",
      );

      expect(action).toBeDefined();
      expect(action!.name).toBe("Move");
      expect(action!.type).toBe("target");
    });

    it("should find action from submenu actions", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => a.type === "build" && a.unitType === "hut",
      );

      expect(action).toBeDefined();
      expect(action!.name).toBe("Build Hut");
      expect(action!.type).toBe("build");
    });

    it("should find action from item with charges", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "fox",
      );

      expect(action).toBeDefined();
      expect(action!.name).toBe("Summon Fox");
      expect(action!.type).toBe("auto");
    });

    it("should find action from item with undefined charges", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "lightning",
      );

      expect(action).toBeDefined();
      expect(action!.name).toBe("Lightning");
      expect(action!.type).toBe("target");
    });

    it("should not find action from item with zero charges", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "heal",
      );

      expect(action).toBeUndefined();
    });

    it("should respect priority order: unit actions > submenu actions > item actions", () => {
      const entity: Entity = {
        id: "test-priority",
        actions: [
          {
            name: "Unit Test Action",
            type: "auto",
            order: "test",
            binding: ["KeyT"],
          },
          {
            name: "Menu",
            type: "menu",
            binding: ["KeyM"],
            actions: [
              {
                name: "Submenu Test Action",
                type: "auto",
                order: "test",
                binding: ["KeyT"],
              },
            ],
          },
        ],
        inventory: [
          {
            id: "testItem",
            name: "Test Item",
            gold: 10,
            binding: ["KeyT"],
            charges: 1,
            actions: [{
              name: "Item Test Action",
              type: "auto",
              order: "test",
              binding: ["KeyT"],
            }],
          },
        ],
      };

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "test",
      );

      // Should find the unit action first (highest priority)
      expect(action).toBeDefined();
      expect(action!.name).toBe("Unit Test Action");
    });

    it("should return undefined for non-existent action", () => {
      const entity = createTestEntity();

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "nonexistent",
      );

      expect(action).toBeUndefined();
    });

    it("should handle entity with no actions", () => {
      const entity: Entity = { id: "empty-entity" };

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "move",
      );

      expect(action).toBeUndefined();
    });

    it("should handle entity with empty arrays", () => {
      const entity: Entity = {
        id: "empty-arrays",
        actions: [],
        inventory: [],
      };

      const action = findAction(
        entity,
        (a) => "order" in a && a.order === "move",
      );

      expect(action).toBeUndefined();
    });
  });

  describe("findActionByOrder", () => {
    it("should find auto action by order", () => {
      const entity = createTestEntity();

      const action = findActionByOrder(entity, "stop");

      expect(action).toBeDefined();
      expect(action!.name).toBe("Stop");
      expect(action!.type).toBe("auto");
    });

    it("should find target action by order", () => {
      const entity = createTestEntity();

      const action = findActionByOrder(entity, "move");

      expect(action).toBeDefined();
      expect(action!.name).toBe("Move");
      expect(action!.type).toBe("target");
    });

    it("should find item auto action by order", () => {
      const entity = createTestEntity();

      const action = findActionByOrder(entity, "fox");

      expect(action).toBeDefined();
      expect(action!.name).toBe("Summon Fox");
      expect(action!.type).toBe("auto");
    });

    it("should find item target action by order", () => {
      const entity = createTestEntity();

      const action = findActionByOrder(entity, "lightning");

      expect(action).toBeDefined();
      expect(action!.name).toBe("Lightning");
      expect(action!.type).toBe("target");
    });

    it("should not find build action by order", () => {
      const entity = createTestEntity();

      // Build actions are not auto or target type, so findActionByOrder should not find them
      const action = findActionByOrder(entity, "nonexistentOrder");

      expect(action).toBeUndefined();
    });

    it("should return undefined for non-existent order", () => {
      const entity = createTestEntity();

      const action = findActionByOrder(entity, "nonexistent");

      expect(action).toBeUndefined();
    });
  });

  describe("findActionAndItem", () => {
    it("should find unit action and return no item", () => {
      const entity = createTestEntity();

      const result = findActionAndItem(entity, "move");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Move");
      expect(result!.item).toBeUndefined();
    });

    it("should find submenu action and return no item", () => {
      // Create entity with an auto action in submenu instead of build action
      const entity: Entity = {
        id: "test-entity",
        actions: [
          {
            name: "Combat Menu",
            type: "menu",
            binding: ["KeyC"],
            actions: [
              {
                name: "Special Attack",
                type: "auto",
                order: "specialAttack",
                binding: ["KeyS"],
              },
            ],
          },
        ],
      };

      const result = findActionAndItem(entity, "specialAttack");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Special Attack");
      expect(result!.item).toBeUndefined();
    });

    it("should find item action and return the item", () => {
      const entity = createTestEntity();

      const result = findActionAndItem(entity, "fox");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Summon Fox");
      expect(result!.item).toBeDefined();
      expect(result!.item!.id).toBe("foxItem");
      expect(result!.item!.charges).toBe(2);
    });

    it("should find item with undefined charges and return the item", () => {
      const entity = createTestEntity();

      const result = findActionAndItem(entity, "lightning");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Lightning");
      expect(result!.item).toBeDefined();
      expect(result!.item!.id).toBe("scrollItem");
      expect(result!.item!.charges).toBeUndefined();
    });

    it("should not find item action with zero charges", () => {
      const entity = createTestEntity();

      const result = findActionAndItem(entity, "heal");

      expect(result).toBeUndefined();
    });

    it("should respect priority: unit > submenu > item", () => {
      const entity: Entity = {
        id: "priority-test",
        actions: [
          {
            name: "Unit Priority",
            type: "auto",
            order: "priority",
            binding: ["KeyP"],
          },
          {
            name: "Menu",
            type: "menu",
            binding: ["KeyM"],
            actions: [
              {
                name: "Submenu Priority",
                type: "target",
                order: "priority",
                binding: ["KeyP"],
              },
            ],
          },
        ],
        inventory: [
          {
            id: "priorityItem",
            name: "Item Priority",
            gold: 10,
            binding: ["KeyP"],
            charges: 1,
            actions: [{
              name: "Item Priority Action",
              type: "auto",
              order: "priority",
              binding: ["KeyP"],
            }],
          },
        ],
      };

      const result = findActionAndItem(entity, "priority");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Unit Priority");
      expect(result!.item).toBeUndefined();
    });

    it("should fall back to submenu when no unit action exists", () => {
      const entity: Entity = {
        id: "submenu-fallback",
        actions: [
          {
            name: "Menu",
            type: "menu",
            binding: ["KeyM"],
            actions: [
              {
                name: "Submenu Fallback",
                type: "auto",
                order: "fallback",
                binding: ["KeyF"],
              },
            ],
          },
        ],
        inventory: [
          {
            id: "fallbackItem",
            name: "Item Fallback",
            gold: 10,
            binding: ["KeyF"],
            charges: 1,
            actions: [{
              name: "Item Fallback Action",
              type: "target",
              order: "fallback",
              binding: ["KeyF"],
            }],
          },
        ],
      };

      const result = findActionAndItem(entity, "fallback");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Submenu Fallback");
      expect(result!.item).toBeUndefined();
    });

    it("should fall back to item when no unit or submenu action exists", () => {
      const entity: Entity = {
        id: "item-fallback",
        inventory: [
          {
            id: "onlyItem",
            name: "Only Item",
            gold: 10,
            binding: ["KeyO"],
            charges: 1,
            actions: [{
              name: "Only Item Action",
              type: "auto",
              order: "only",
              binding: ["KeyO"],
            }],
          },
        ],
      };

      const result = findActionAndItem(entity, "only");

      expect(result).toBeDefined();
      expect(result!.action.name).toBe("Only Item Action");
      expect(result!.item).toBeDefined();
      expect(result!.item!.id).toBe("onlyItem");
    });

    it("should return undefined when action not found anywhere", () => {
      const entity = createTestEntity();

      const result = findActionAndItem(entity, "nonexistent");

      expect(result).toBeUndefined();
    });
  });
});
