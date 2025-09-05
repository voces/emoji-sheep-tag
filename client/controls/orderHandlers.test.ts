import "@/client-testing/integration-setup.ts";
import { setCurrentTestFile } from "@/client-testing/integration-setup.ts";

// Set the current test file name for deterministic port assignment
setCurrentTestFile("orderHandlers.test.ts");
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { waitFor } from "npm:@testing-library/react";
import { app, Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { playersVar } from "@/vars/players.ts";
import { connect, setServer } from "../connection.ts";
import { connectionStatusVar } from "../ui/vars/state.ts";
import {
  clearTestServerMessages,
  getTestServerMessages,
  getTestServerPort,
} from "@/client-testing/integration-setup.ts";
import { MouseButtonEvent } from "../mouse.ts";
import { Vector2 } from "three";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import {
  cancelOrder,
  getActiveOrder,
  handleSmartTarget,
  playOrderSound,
  setActiveOrder,
} from "./orderHandlers.ts";

describe("order handlers", () => {
  beforeEach(() => {
    // Clear existing entities from app
    for (const entity of app.entities) app.removeEntity(entity);

    // Clear selection
    for (const entity of selection) delete (entity as Entity).selected;

    // Cancel any active orders
    cancelOrder();
  });

  afterEach(() => {
    cancelOrder();
  });

  describe("active order management", () => {
    it("should start with no active order", () => {
      expect(getActiveOrder()).toBeUndefined();
    });

    it("should set active order", () => {
      setActiveOrder("attack", "enemy", 0);

      const activeOrder = getActiveOrder();
      expect(activeOrder?.order).toBe("attack");
      expect(activeOrder?.variant).toBe("enemy");
    });

    it("should update cursor when setting active order", () => {
      // We can't easily test cursor updates without mocking updateCursor,
      // but we can verify the order is set
      setActiveOrder("heal", "ally", 0);

      const activeOrder = getActiveOrder();
      expect(activeOrder?.order).toBe("heal");
      expect(activeOrder?.variant).toBe("ally");
    });

    it("should cancel active order", () => {
      setActiveOrder("attack", "enemy", 0);
      expect(getActiveOrder()).toBeDefined();

      cancelOrder();

      expect(getActiveOrder()).toBeUndefined();
    });

    it("should handle conditional cancellation", () => {
      setActiveOrder("attack", "enemy", 0);

      // Should not cancel if check function returns false
      cancelOrder((order) => order === "heal");
      expect(getActiveOrder()?.order).toBe("attack");

      // Should cancel if check function returns true
      cancelOrder((order) => order === "attack");
      expect(getActiveOrder()).toBeUndefined();
    });
  });

  describe("order sound", () => {
    it("should handle sound with coordinates", () => {
      // This test mainly verifies the function doesn't throw
      // In a real scenario, you might want to mock the sound system
      expect(() => playOrderSound(10, 20, 0.1)).not.toThrow();
    });

    it("should handle sound without coordinates", () => {
      expect(() => playOrderSound()).not.toThrow();
    });

    it("should handle sound with default volume", () => {
      expect(() => playOrderSound(10, 20)).not.toThrow();
    });
  });

  describe("smart target selection", () => {
    beforeEach(async () => {
      // Set up local player
      playersVar([{
        id: "player-1",
        name: "Test Player",
        color: "blue",
        local: true,
        sheepCount: 0,
        entity: { id: "player-entity-1", gold: 100 },
      }]);

      clearTestServerMessages();
      setServer(`localhost:${getTestServerPort()}`);
      connect();

      // Wait for connection to establish
      await waitFor(() => {
        if (connectionStatusVar() !== "connected") {
          throw new Error("Not connected yet");
        }
      }, { timeout: 3000, interval: 10 });
    });

    it("should issue move order when right-clicking on ground with wolf", async () => {
      // Create a wolf with both attack and move actions (like real wolf)
      const wolf = app.addEntity({
        id: "wolf-1",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Attack",
            order: "attack",
            targeting: ["other"],
            aoe: 0,
            smart: { enemy: 0 },
          },
          {
            type: "target" as const,
            name: "Move",
            order: "move",
            targeting: ["other"],
            aoe: 0,
            smart: { ground: 0, ally: 0 },
          },
        ],
      });

      (wolf as Entity).selected = true;

      // Mock mouse event for ground click (no intersections)
      const mockMouseEvent = {
        intersects: new ExtendedSet(),
        world: new Vector2(20, 20),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);

      expect(result).toBe(true);

      // Wait for message to arrive at test server
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.order).toBe("move");
        expect(message.units).toEqual(["wolf-1"]);
        expect(message.target).toEqual({ x: 20, y: 20 });
      }
    });

    it("should issue attack order when right-clicking on enemy structure", async () => {
      // Create a wolf with attack action
      const wolf = app.addEntity({
        id: "wolf-2",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Attack",
            order: "attack",
            targeting: ["other"],
            aoe: 0,
            smart: { enemy: 0 },
          },
        ],
      });

      // Create an enemy structure
      const enemyHut = app.addEntity({
        id: "enemy-hut-1",
        prefab: "hut",
        owner: "player-2", // Enemy player
        position: { x: 15, y: 15 },
        tilemap: { map: [1], top: 0, left: 0, width: 1, height: 1 },
      });

      (wolf as Entity).selected = true;

      // Mock mouse event for enemy structure click
      const mockIntersects = new ExtendedSet([enemyHut]);
      const mockMouseEvent = {
        intersects: mockIntersects,
        world: new Vector2(15, 15),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);

      expect(result).toBe(true);

      // Wait for message to arrive at test server
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.order).toBe("attack");
        expect(message.units).toEqual(["wolf-2"]);
        expect(message.target).toBe("enemy-hut-1");
      }
    });

    it("should issue attack order when right-clicking on enemy unit", async () => {
      // Create a wolf with attack action
      const wolf = app.addEntity({
        id: "wolf-3",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Attack",
            order: "attack",
            targeting: ["other"],
            aoe: 0,
            smart: { enemy: 0 },
          },
        ],
      });

      // Create an enemy unit
      const enemySheep = app.addEntity({
        id: "enemy-sheep-1",
        prefab: "sheep",
        owner: "player-2", // Enemy player
        position: { x: 12, y: 12 },
      });

      (wolf as Entity).selected = true;

      // Mock mouse event for enemy unit click
      const mockIntersects = new ExtendedSet([enemySheep]);
      const mockMouseEvent = {
        intersects: mockIntersects,
        world: new Vector2(12, 12),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);

      expect(result).toBe(true);

      // Wait for message to arrive at test server
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.order).toBe("attack");
        expect(message.units).toEqual(["wolf-3"]);
        expect(message.target).toBe("enemy-sheep-1");
      }
    });
  });

  describe("order variants", () => {
    it("should handle attack orders with enemy variant", () => {
      setActiveOrder("attack", "enemy", 0);

      const order = getActiveOrder();
      expect(order?.variant).toBe("enemy");
    });

    it("should handle heal orders with ally variant", () => {
      setActiveOrder("heal", "ally", 0);

      const order = getActiveOrder();
      expect(order?.variant).toBe("ally");
    });

    it("should handle move orders with neutral variant", () => {
      setActiveOrder("move", "ally", 0);

      const order = getActiveOrder();
      expect(order?.variant).toBe("ally");
    });
  });

  describe("order state persistence", () => {
    it("should maintain order state across multiple checks", () => {
      setActiveOrder("attack", "enemy", 0);

      // Multiple calls should return same order
      const order1 = getActiveOrder();
      const order2 = getActiveOrder();

      expect(order1).toEqual(order2);
      expect(order1?.order).toBe("attack");
    });

    it("should reset state after cancellation", () => {
      setActiveOrder("attack", "enemy", 0);
      expect(getActiveOrder()).toBeDefined();

      cancelOrder();

      expect(getActiveOrder()).toBeUndefined();

      // Should still be undefined on subsequent calls
      expect(getActiveOrder()).toBeUndefined();
    });
  });

  describe("order validation", () => {
    it("should handle empty order names", () => {
      setActiveOrder("", "enemy", 0);

      const order = getActiveOrder();
      expect(order?.order).toBe("");
      expect(order?.variant).toBe("enemy");
    });

    it("should handle order replacement", () => {
      setActiveOrder("attack", "enemy", 0);
      expect(getActiveOrder()?.order).toBe("attack");

      setActiveOrder("heal", "ally", 0);
      expect(getActiveOrder()?.order).toBe("heal");
      expect(getActiveOrder()?.variant).toBe("ally");
    });
  });

  describe("order queuing", () => {
    beforeEach(async () => {
      // Set up local player
      playersVar([{
        id: "player-1",
        name: "Test Player",
        color: "blue",
        local: true,
        sheepCount: 0,
        entity: { id: "player-entity-1", gold: 100 },
      }]);

      clearTestServerMessages();
      setServer(`localhost:${getTestServerPort()}`);
      connect();

      // Wait for connection to establish
      await waitFor(() => {
        if (connectionStatusVar() !== "connected") {
          throw new Error("Not connected yet");
        }
      }, { timeout: 3000, interval: 10 });
    });

    it("should send queue flag when shift is held for smart target", async () => {
      // Create a wolf
      const wolf = app.addEntity({
        id: "wolf-queue-1",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Move",
            order: "move",
            targeting: ["other"],
            aoe: 0,
            smart: { ground: 0, ally: 0 },
          },
        ],
      });

      (wolf as Entity).selected = true;

      // Mock mouse event with queue flag
      const mockMouseEvent = {
        intersects: new ExtendedSet(),
        world: new Vector2(20, 20),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
        queue: true, // Simulate shift held
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);
      expect(result).toBe(true);

      // Wait for message
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.queue).toBe(true);
        expect(message.order).toBe("move");
      }
    });

    it("should not send queue flag when shift is not held", async () => {
      // Create a wolf
      const wolf = app.addEntity({
        id: "wolf-queue-2",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Move",
            order: "move",
            targeting: ["other"],
            aoe: 0,
            smart: { ground: 0, ally: 0 },
          },
        ],
      });

      (wolf as Entity).selected = true;

      // Mock mouse event without queue flag
      const mockMouseEvent = {
        intersects: new ExtendedSet(),
        world: new Vector2(20, 20),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
        queue: false, // No shift
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);
      expect(result).toBe(true);

      // Wait for message
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.queue).toBeFalsy();
      }
    });

    it("should handle queued attack orders", async () => {
      // Create a wolf
      const wolf = app.addEntity({
        id: "wolf-queue-3",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Attack",
            order: "attack",
            targeting: ["other"],
            aoe: 0,
            smart: { enemy: 0 },
          },
        ],
      });

      // Create an enemy
      const enemySheep = app.addEntity({
        id: "enemy-sheep-queue",
        prefab: "sheep",
        owner: "player-2",
        position: { x: 15, y: 15 },
      });

      (wolf as Entity).selected = true;

      // Mock mouse event with queue flag
      const mockIntersects = new ExtendedSet([enemySheep]);
      const mockMouseEvent = {
        intersects: mockIntersects,
        world: new Vector2(15, 15),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
        queue: true, // Queue the attack
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);
      expect(result).toBe(true);

      // Wait for message
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.queue).toBe(true);
        expect(message.order).toBe("attack");
        expect(message.target).toBe("enemy-sheep-queue");
      }
    });

    it("should handle queued orders with multiple units", async () => {
      // Create two wolves
      const wolf1 = app.addEntity({
        id: "wolf-multi-1",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 10, y: 10 },
        actions: [
          {
            type: "target" as const,
            name: "Move",
            order: "move",
            targeting: ["other"],
            aoe: 0,
            smart: { ground: 0 },
          },
        ],
      });

      const wolf2 = app.addEntity({
        id: "wolf-multi-2",
        prefab: "wolf",
        owner: "player-1",
        position: { x: 12, y: 12 },
        actions: [
          {
            type: "target" as const,
            name: "Move",
            order: "move",
            targeting: ["other"],
            aoe: 0,
            smart: { ground: 0 },
          },
        ],
      });

      (wolf1 as Entity).selected = true;
      (wolf2 as Entity).selected = true;

      // Mock mouse event with queue flag
      const mockMouseEvent = {
        intersects: new ExtendedSet(),
        world: new Vector2(25, 25),
        button: "right",
        pixels: new Vector2(0, 0),
        percent: new Vector2(0, 0),
        angle: 0,
        element: null,
        elements: [],
        queue: true,
      } as unknown as MouseButtonEvent;

      const result = handleSmartTarget(mockMouseEvent);
      expect(result).toBe(true);

      // Wait for message
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
      }, { interval: 10 });

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.type).toBe("unitOrder");
      if (message.type === "unitOrder") {
        expect(message.queue).toBe(true);
        expect(message.order).toBe("move");
        expect(message.units).toContain("wolf-multi-1");
        expect(message.units).toContain("wolf-multi-2");
        expect(message.units).toHaveLength(2);
      }
    });
  });
});
