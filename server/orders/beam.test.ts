import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { unitOrder } from "../actions/unitOrder.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { addItem, newUnit } from "../api/unit.ts";
import { items } from "@/shared/data.ts";
import { TICK_RATE } from "@/shared/constants.ts";

afterEach(cleanupTest);

describe("beam integration", () => {
  describe("Beam item", () => {
    it("should add beam to inventory with correct properties", {
      wolves: ["wolf-player"],
    }, function* ({ clients }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf unit
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);

      yield;

      // Add beam to wolf's inventory
      const success = addItem(wolf, "beam");
      expect(success).toBe(true);
      expect(wolf.inventory).toHaveLength(1);
      expect(wolf.inventory![0].id).toBe("beam");
      expect(wolf.inventory![0].name).toBe("Beam");
      expect(wolf.inventory![0].charges).toBe(1);
    });

    it("should consume beam charge when used", {
      wolves: ["wolf-player"],
    }, function* ({ clients, ecs }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf unit with beam
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.beam];

      yield;

      // Use the beam targeting a point
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "beam",
        target: { x: 10, y: 5 },
        queue: false,
      });

      yield;

      // Wait for cast to complete (0.3 seconds)
      const castTicks = Math.ceil(0.3 / TICK_RATE);
      for (let i = 0; i < castTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Beam should be consumed from inventory
      expect(wolf.inventory).toHaveLength(0);
    });
  });

  describe("Beam damage", () => {
    it("should damage structures in beam path", {
      wolves: ["wolf-player"],
    }, function* ({ clients, ecs }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with beam
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.beam];

      // Create a hut in the beam path
      const hut = newUnit(wolfClient.id, "hut", 8, 5);
      const initialHealth = hut.health!;

      yield;

      // Fire beam at a point past the hut
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "beam",
        target: { x: 10, y: 5 },
        queue: false,
      });

      yield;

      // Wait for cast to complete (0.25 seconds)
      const castTicks = Math.ceil(0.25 / TICK_RATE);
      for (let i = 0; i < castTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Run for duration of beam (0.2 seconds = 4 ticks at 50ms per tick)
      const beamTicks = Math.ceil(0.2 / TICK_RATE);
      for (let i = 0; i < beamTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Hut should have taken damage (10 damage per tick)
      expect(hut.health).toBeLessThan(initialHealth);
    });

    it("should not damage units", {
      wolves: ["wolf-player"],
      sheep: ["sheep-player"],
    }, function* ({ clients, ecs }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with beam
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.beam];

      // Create a sheep in the beam path
      const sheep = newUnit("sheep-player", "sheep", 8, 5);
      const initialHealth = sheep.health!;

      yield;

      // Fire beam at a point past the sheep
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "beam",
        target: { x: 10, y: 5 },
        queue: false,
      });

      yield;

      // Wait for cast to complete (0.25 seconds)
      const castTicks = Math.ceil(0.25 / TICK_RATE);
      for (let i = 0; i < castTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Run for duration of beam
      const beamTicks = Math.ceil(0.2 / TICK_RATE);
      for (let i = 0; i < beamTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Sheep should not take damage (beam only damages structures)
      expect(sheep.health).toBe(initialHealth);
    });

    it("should not damage structures outside beam path", {
      wolves: ["wolf-player"],
    }, function* ({ clients, ecs }) {
      const wolfClient = clients.get("wolf-player")!;

      // Create wolf with beam
      const wolf = newUnit(wolfClient.id, "wolf", 5, 5);
      wolf.inventory = [items.beam];

      // Create a hut off to the side of the beam path
      const hut = newUnit(wolfClient.id, "hut", 8, 8);
      const initialHealth = hut.health!;

      yield;

      // Fire beam horizontally
      unitOrder(wolfClient, {
        type: "unitOrder",
        units: [wolf.id],
        order: "beam",
        target: { x: 10, y: 5 },
        queue: false,
      });

      yield;

      // Wait for cast to complete (0.25 seconds)
      const castTicks = Math.ceil(0.25 / TICK_RATE);
      for (let i = 0; i < castTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Run for duration of beam
      const beamTicks = Math.ceil(0.2 / TICK_RATE);
      for (let i = 0; i < beamTicks; i++) {
        ecs.tick++;
        ecs.update(TICK_RATE);
        yield;
      }

      // Hut should not take damage (it's outside the beam path)
      expect(hut.health).toBe(initialHealth);
    });
  });
});
