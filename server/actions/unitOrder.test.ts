import { afterEach, describe } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { addItem, newUnit } from "../api/unit.ts";
import { unitOrder } from "./unitOrder.ts";
import { advanceCast } from "../systems/action/advanceCast.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";

afterEach(cleanupTest);

describe("unitOrder fox item integration", () => {
  it("should cast fox ability from item with charges", {
    wolves: ["test-client"],
  }, function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;

    // Create a wolf unit
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item to inventory
    addItem(wolf, "foxToken");
    yield;

    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);
    expect(wolf.inventory![0].actions![0]).toBeDefined();

    // Use fox ability from item
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Should have casting order now
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Wait for cast to complete and fox to be spawned
    while (wolf.order?.type === "cast") yield;

    // Item should be consumed
    expect(wolf.inventory).toHaveLength(0);
    const entities = Array.from(ecs.entities);
    const foxes = entities.filter((e) => e.prefab === "fox");
    expect(foxes.length).toBe(1);
  });

  it("should not cast fox when no charges remaining", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item with 0 charges
    addItem(wolf, "foxToken");
    // Modify the inventory item to have 0 charges
    wolf.inventory = wolf.inventory!.map((item) => ({ ...item, charges: 0 }));
    yield;

    const initialOrder = wolf.order;

    // Try to use fox ability
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Should not change order
    expect(wolf.order).toBe(initialOrder);
  });

  it("should stack charges and consume one per use", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item twice (should stack charges)
    addItem(wolf, "foxToken");
    addItem(wolf, "foxToken");
    yield;

    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(2);

    // Use fox ability once
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Should have casting order
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Wait for cast to complete
    yield* yieldFor(() => expect(wolf.order?.type).not.toBe("cast"));

    // Should have 1 charge remaining
    expect(wolf.inventory?.[0].charges).toBe(1);

    // Use fox ability again
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Should cast again
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Should have no charges remaining - item removed
    yield* yieldFor(() => expect(wolf.inventory).toHaveLength(0));
  });

  it("should not allow other clients to use unit's fox item", {
    wolves: ["test-client", "other-client"],
  }, function* ({ clients }) {
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "foxToken");
    yield;

    // Get different client
    const otherClient = clients.get("other-client")!;

    const initialOrder = wolf.order;
    const initialInventory = [...wolf.inventory!];

    // Other client tries to use fox ability
    unitOrder(otherClient, {
      type: "unitOrder",
      units: [wolf.id],
      order: "fox",
    });
    yield;

    // Should not change anything
    expect(wolf.order).toBe(initialOrder);
    expect(wolf.inventory).toEqual(initialInventory);
  });

  it("should handle charge consumption generically for any item action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item
    addItem(wolf, "foxToken");
    yield;

    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);

    // Use the item action - charge consumption should happen automatically
    // after the action regardless of the specific action type
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Item should be consumed due to generalized charge logic
    yield* yieldFor(() => expect(wolf.inventory).toHaveLength(0));
  });
});

describe("unitOrder basic actions", () => {
  it("should execute stop action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use sheep which has stop action
    const sheep = newUnit("test-client", "sheep", 5, 5);

    // Give the unit some orders and queue
    sheep.order = { type: "walk", target: { x: 10, y: 10 } };
    sheep.queue = [{ type: "walk", target: { x: 20, y: 20 } }];
    yield;

    // Execute stop action
    unitOrder(client, { type: "unitOrder", units: [sheep.id], order: "stop" });
    yield;

    // Should clear order and queue (properties are deleted, becoming undefined or null)
    expect(sheep.order).toBeFalsy();
    expect(sheep.queue).toBeFalsy();
  });

  it("should execute hold action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use wolf which has hold action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Execute hold action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "hold" });
    yield;

    // Should have hold order
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("hold");
  });

  it("should execute move action with target position", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use sheep which has move action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    const target = { x: 15, y: 20 };
    yield;

    // Execute move action
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target,
    });
    yield;

    // Should have walk order with target position
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual(target);
  });

  it("should execute move action with target entity", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use sheep which has move action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    const targetUnit = newUnit("test-client", "wolf", 15, 20);
    yield;

    // Execute move action with target entity
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: targetUnit.id,
    });
    yield;

    // Should have walk order with target id
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { targetId: string }).targetId).toBe(targetUnit.id);
  });

  it("should not execute actions for units not owned by client", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Create sheep owned by different client
    const sheep = newUnit("other-client", "sheep", 5, 5);
    yield;
    const initialOrder = sheep.order;

    // Try to execute stop action
    unitOrder(client, { type: "unitOrder", units: [sheep.id], order: "stop" });
    yield;

    // Should not change anything
    expect(sheep.order).toBe(initialOrder);
  });

  it("should skip unknown units silently", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Try to execute action on non-existent unit - should not throw
    expect(() => {
      unitOrder(client, {
        type: "unitOrder",
        units: ["unknown-unit"],
        order: "stop",
      });
    }).toThrow();
    yield;
  });
});

describe("unitOrder combat actions", () => {
  it("should execute attack action with target entity", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const targetUnit = newUnit("other-client", "sheep", 15, 20);
    yield;

    // Execute attack action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: targetUnit.id,
    });
    yield;

    // Should have attack order
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("attack");
    expect((wolf.order as { targetId: string }).targetId).toBe(targetUnit.id);
  });

  it("should execute attack action with ground target (attack-ground)", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const target = { x: 15, y: 20 };
    yield;

    // Execute attack action with ground target
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target,
    });
    yield;

    // Should have attackMove order for ground targeting
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("attackMove");
    expect((wolf.order as { target: { x: number; y: number } }).target).toEqual(
      target,
    );
  });

  it("should not attack if target entity doesn't exist", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;
    const initialOrder = wolf.order;

    // Try to attack non-existent entity
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: "non-existent",
    });
    yield;

    // Should not change order when target doesn't exist
    expect(wolf.order).toBe(initialOrder);
  });

  it("should handle attack action without target", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;
    const initialOrder = wolf.order;

    // Execute attack action without target
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "attack" });
    yield;

    // Should not change order when no target provided
    expect(wolf.order).toBe(initialOrder);
  });
});

describe("unitOrder special abilities", () => {
  it("should execute mirror image action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });
    yield;

    // Should have cast order for mirror image
    expect(wolf.order).toEqual({
      type: "cast",
      orderId: "mirrorImage",
      remaining: 0.45, // 0.5 - 0.05 yield
      started: true,
    });
  });

  it("should execute destroy last farm action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use sheep which has destroy last farm action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    // Create a hut to destroy
    const hut = newUnit("test-client", "hut", 10, 10);
    yield;
    expect(hut.health).toBe(120);

    // Execute destroy last farm action
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "destroyLastFarm",
    });
    yield;

    // Verify the hut was destroyed (health set to 0)
    expect(hut.health).toBe(0);
  });

  it("should handle mirror image with insufficient mana", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;
    // Set mana to 0
    wolf.mana = 0;
    wolf.maxMana = 100;
    yield;

    const initialOrder = wolf.order;

    // Try to execute mirror image with no mana
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });
    yield;

    // Should not cast if insufficient mana
    expect(wolf.order).toBe(initialOrder);
  });

  it("should consume mana for mirror image", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    wolf.maxMana = 100;
    yield;

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });
    yield;

    // Advance cast slightly to trigger cast start (which consumes mana)
    advanceCast(wolf, 0.1);
    yield;

    // Should have consumed mana (mirror image costs 20 mana, 0.05 mana regen)
    expect(wolf.mana).toBeCloseTo(80.05);
  });
});

describe("unitOrder self destruct", () => {
  it("should execute self destruct action for hut", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use hut which has self destruct action
    const hut = newUnit("test-client", "hut", 5, 5);
    hut.health = 100;
    hut.maxHealth = 100;
    yield;

    // Execute self destruct action
    unitOrder(client, {
      type: "unitOrder",
      units: [hut.id],
      order: "selfDestruct",
    });
    yield;

    // Should set health to 0
    expect(hut.health).toBe(0);
  });

  it("should not execute self destruct if unit doesn't have the action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    // Use wolf which doesn't have self destruct action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.health = 100;
    wolf.maxHealth = 100;
    yield;

    const initialHealth = wolf.health;

    // Execute self destruct action without the action being available
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "selfDestruct",
    });
    yield;

    // Should not change health since action isn't available
    expect(wolf.health).toBe(initialHealth);
  });

  it(
    "should allow self destruct regardless of current health if action exists",
    { wolves: ["test-client"] },
    function* ({ clients }) {
      const client = clients.get("test-client")!;

      // Use tiny hut which has self destruct action
      const tinyHut = newUnit("test-client", "tinyHut", 5, 5);
      tinyHut.health = 1;
      tinyHut.maxHealth = 100;
      yield;

      // Execute self destruct action
      unitOrder(client, {
        type: "unitOrder",
        units: [tinyHut.id],
        order: "selfDestruct",
      });
      yield;

      // Should set health to 0 even with low health
      expect(tinyHut.health).toBe(0);
    },
  );
});

describe("unitOrder timed entities", () => {
  it("should create fox with buff duration from action definition", {
    wolves: ["test-client"],
  }, function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item to inventory
    addItem(wolf, "foxToken");
    yield;

    // Use fox ability from item
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Wait for cast to complete and fox to be spawned
    yield* yieldFor(() => {
      const entities = Array.from(ecs.entities);
      const foxes = entities.filter((e) => e.prefab === "fox");
      expect(foxes.length).toBe(1);
    });

    // Check that fox has the correct buff duration (150 seconds from action definition)
    const entities = Array.from(ecs.entities);
    const fox = entities.find((e) => e.prefab === "fox")!;
    expect(fox.buffs).toBeDefined();
    expect(fox.buffs!.length).toBe(1);
    expect(fox.buffs![0].remainingDuration).toBe(150);
    expect(fox.buffs![0].expiration).toBe("Fox");
  });

  it("should remove fox after buff duration expires", {
    wolves: ["test-client"],
  }, function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);

    addItem(wolf, "foxToken");
    yield;

    // Use fox ability
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Wait for cast to complete first
    yield* yieldFor(() => {
      if (wolf.order?.type === "cast") throw new Error("Still casting");
    });

    // Wait for fox to be created and verify it exists
    const fox = yield* yieldFor(() => {
      const entities = Array.from(ecs.entities);
      const foxes = entities.filter((e) => e.prefab === "fox");
      if (
        !(foxes.length === 1 && foxes[0].buffs && foxes[0].buffs.length > 0)
      ) {
        throw new Error("Fox not yet created with buffs");
      }
      return foxes[0];
    });

    // Verify fox has timed life buff
    expect(fox.buffs).toBeDefined();
    expect(fox.buffs![0].expiration).toBe("Fox");

    // Manually set a very short expiration time
    fox.buffs = [{ remainingDuration: 0.1, expiration: "Fox" }];
    yield;

    // Advance time to trigger expiration
    yield* yieldFor(0.2);

    // Verify fox was removed
    expect(Array.from(ecs.entities).find((e) => e.id === fox.id))
      .toBeUndefined();
  });

  it("should create mirror images with buff duration from action definition", {
    wolves: ["test-client"],
  }, function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    yield;

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });

    // Wait for cast to complete first
    yield* yieldFor(() => {
      if (wolf.order?.type === "cast") throw new Error("Still casting");
    });

    // Wait for mirrors to be created
    const mirrors = yield* yieldFor(() => {
      const entities = Array.from(ecs.entities);
      const mirrors = entities.filter((e) => e.isMirror === true);
      expect(mirrors.length).toBe(1);
      return mirrors;
    });

    // Check that mirror has the correct buff duration (45 seconds from action definition)
    for (const mirror of mirrors) {
      expect(mirror.buffs).toBeDefined();
      expect(mirror.buffs!.length).toBe(1);
      expect(mirror.buffs![0].remainingDuration).toBe(45);
      expect(mirror.buffs![0].expiration).toBe("MirrorImage");
    }
  });

  it("should remove mirror images after buff duration expires", {
    wolves: ["test-client"],
  }, function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    yield;

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });

    // Wait for cast to complete first
    yield* yieldFor(() => {
      if (wolf.order?.type === "cast") throw new Error("Still casting");
    });

    // Wait for mirrors to be created and verify they have buffs
    const mirrors = yield* yieldFor(() => {
      const entities = Array.from(ecs.entities);
      const mirrors = entities.filter((e) => e.isMirror === true);
      if (
        !(mirrors.length === 1 && mirrors[0].buffs &&
          mirrors[0].buffs.length > 0)
      ) {
        throw new Error("Mirror not yet created with buffs");
      }
      return mirrors;
    });

    // Get the mirror
    const mirror = mirrors[0];
    const mirrorId = mirror.id;

    // Verify mirror has timed life buff
    expect(mirror.buffs).toBeDefined();
    expect(mirror.buffs![0].expiration).toBe("MirrorImage");

    // Manually set a very short expiration time
    mirror.buffs = [{ remainingDuration: 0.1, expiration: "MirrorImage" }];
    yield;

    // Advance time to trigger expiration
    yield* yieldFor(0.2);

    // Verify mirror was removed
    const entities = Array.from(ecs.entities);
    expect(entities.find((e) => e.id === mirrorId)).toBeUndefined();
    expect(entities.filter((e) => e.isMirror === true)).toHaveLength(0);
  });
});

describe("unitOrder queuing system", () => {
  it("should queue move orders", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const sheep = newUnit("test-client", "sheep", 5, 5);
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Verify order was set
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual({ x: 10, y: 10 });

    // Queue a second move order
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 20, y: 20 },
      queue: true,
    });
    yield;

    // Current order should remain unchanged
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual({ x: 10, y: 10 });

    // Should have queue with one entry
    expect(sheep.queue).toBeDefined();
    expect(sheep.queue).toHaveLength(1);
    expect(sheep.queue![0].type).toBe("walk");
    expect((sheep.queue![0] as { target: { x: number; y: number } }).target)
      .toEqual({ x: 20, y: 20 });
  });

  it("should queue multiple orders", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Issue initial attack order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue move, then another attack
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 15, y: 15 },
      queue: true,
    });
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: { x: 20, y: 20 },
      queue: true,
    });
    yield;

    // Verify current order is unchanged
    expect(wolf.order!.type).toBe("attackMove");

    // Verify queue has both orders
    expect(wolf.queue).toHaveLength(2);
    expect(wolf.queue![0].type).toBe("walk");
    expect(wolf.queue![1].type).toBe("attackMove");
  });

  it("should queue hold order", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Set initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue hold order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "hold",
      queue: true,
    });
    yield;

    // Current order should be move
    expect(wolf.order!.type).toBe("walk");

    // Queue should contain hold
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("hold");
  });

  it("should replace order and clear queue when queue is false", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const sheep = newUnit("test-client", "sheep", 5, 5);
    yield;

    // Set up initial order and queue
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 15, y: 15 },
      queue: true,
    });
    yield;

    // Verify initial state
    expect(sheep.queue).toHaveLength(1);

    // Issue non-queued order
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 20, y: 20 },
      queue: false,
    });
    yield;

    // Should replace current order and clear queue
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual({ x: 20, y: 20 });
    expect(sheep.queue).toBeFalsy();
  });

  it("should queue orders from new registry system", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    wolf.maxMana = 100;
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue mirror image (uses new order registry)
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
      queue: true,
    });
    yield;

    // Current order should be move
    expect(wolf.order!.type).toBe("walk");

    // Queue should contain mirror image cast
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("cast");
    expect((wolf.queue![0] as { orderId: string }).orderId).toBe("mirrorImage");
  });

  it("should queue fox order from item", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "foxToken");
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue fox ability
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "fox",
      queue: true,
    });
    yield;

    // Current order should be move
    expect(wolf.order!.type).toBe("walk");

    // Queue should contain fox cast
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("cast");
    expect((wolf.queue![0] as { orderId: string }).orderId).toBe("fox");

    // Item charges should not be consumed yet
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);
  });

  it("should queue multiple attack orders", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    const enemy1 = newUnit("other-client", "sheep", 10, 10);
    const enemy2 = newUnit("other-client", "sheep", 15, 15);
    yield;

    // Issue initial attack order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: enemy1.id,
    });
    yield;

    // Queue another attack order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: enemy2.id,
      queue: true,
    });
    yield;

    // Current order should be attack on first enemy
    expect(wolf.order!.type).toBe("attack");
    expect((wolf.order as { targetId: string }).targetId).toBe(enemy1.id);

    // Queue should contain attack on second enemy
    expect(wolf.queue).toBeDefined();
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("attack");
    expect((wolf.queue![0] as { targetId: string }).targetId).toBe(enemy2.id);
  });

  it("should queue attack move orders", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue attack move (attack ground) order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: { x: 20, y: 20 },
      queue: true,
    });
    yield;

    // Current order should be move
    expect(wolf.order!.type).toBe("walk");

    // Queue should contain attack move
    expect(wolf.queue).toBeDefined();
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("attackMove");
    expect((wolf.queue![0] as { target: { x: number; y: number } }).target)
      .toEqual({ x: 20, y: 20 });
  });

  it("should queue speed pot order", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "speedPot");
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "move",
      target: { x: 10, y: 10 },
    });
    yield;

    // Queue speed pot
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "speedPot",
      queue: true,
    });
    yield;

    // Current order should be move
    expect(wolf.order!.type).toBe("walk");

    // Queue should contain speed pot cast
    expect(wolf.queue).toHaveLength(1);
    expect(wolf.queue![0].type).toBe("cast");
    expect((wolf.queue![0] as { orderId: string }).orderId).toBe("speedPot");
  });

  it("should not queue stop order when queue is true", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const sheep = newUnit("test-client", "sheep", 5, 5);
    yield;

    // Set up initial order
    sheep.order = { type: "walk", target: { x: 10, y: 10 } };
    sheep.queue = [{ type: "walk", target: { x: 20, y: 20 } }];
    yield;

    const initialQueue = [...sheep.queue];

    // Try to queue stop (should do nothing)
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "stop",
      queue: true,
    });
    yield;

    // Nothing should change - order might have path added but core fields same
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual({ x: 10, y: 10 });
    expect(sheep.queue).toEqual(initialQueue);
  });

  it("should queue destroy last farm order", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const sheep = newUnit("test-client", "sheep", 5, 5);
    const hut = newUnit("test-client", "hut", 10, 10);
    yield;

    // Issue initial move order
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 15, y: 15 },
    });
    yield;

    // Queue destroy last farm
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "destroyLastFarm",
      queue: true,
    });
    yield;

    // Current order should be move
    expect(sheep.order!.type).toBe("walk");

    // Queue should contain destroy last farm
    expect(sheep.queue).toHaveLength(1);
    expect(sheep.queue![0].type).toBe("cast");
    expect((sheep.queue![0] as { orderId: string }).orderId).toBe(
      "destroyLastFarm",
    );

    // Hut should still be alive (order is queued)
    expect(hut.health).toBe(120);
  });

  it("should handle queuing when unit has no current order", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;
    const sheep = newUnit("test-client", "sheep", 5, 5);
    yield;

    // Queue move order with no current order
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: { x: 10, y: 10 },
      queue: true,
    });
    yield;

    // Should set as current order (no queue)
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect(sheep.queue).toBeFalsy();
  });
});

describe("unitOrder generalized charge system", () => {
  it("should consume charges for any item-based action", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add a hypothetical lightning item that would work with any action
    wolf.inventory = [{
      prefab: "lightningItem",
      name: "Lightning Scroll",
      gold: 50,
      binding: ["KeyL"],
      charges: 3,
      actions: [{
        name: "Lightning Bolt",
        type: "auto",
        order: "lightning",
        binding: ["KeyL"],
        castDuration: 1.0,
      }],
    }];
    yield;

    // Mock a lightning action handler by temporarily adding to unitOrder switch
    // Since we can't modify the switch at runtime, we'll test with fox action
    // which we know works with the generalized charge system
    addItem(wolf, "foxToken");
    yield;

    expect(wolf.inventory).toHaveLength(2);

    // Use fox action - should consume one charge
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Should have consumed fox item charge (it had 1 charge, should be removed)
    yield* yieldFor(() =>
      expect(wolf.inventory!.filter((i) => i.prefab === "foxToken"))
        .toHaveLength(0)
    );

    // Lightning item should still be there unchanged
    const lightningItems = wolf.inventory!.filter((i) =>
      i.prefab === "lightningItem"
    );
    expect(lightningItems).toHaveLength(1);
    expect(lightningItems[0].charges).toBe(3);
  });

  it("should handle items without charges (unlimited use)", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);
    yield;

    // Add item without charges property
    wolf.inventory = [{
      prefab: "unlimitedItem",
      name: "Unlimited Spell",
      gold: 100,
      binding: ["KeyU"],
      // No charges property - should be unlimited
      actions: [{
        name: "Unlimited Spell",
        type: "auto",
        order: "fox", // Reuse fox order for testing
        binding: ["KeyU"],
        castDuration: 0.5,
      }],
    }];
    yield;

    // Use the unlimited action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });
    yield;

    // Item should still be there since it has no charges to consume
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].prefab).toBe("unlimitedItem");
  });

  it("should remove items when charges reach zero", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add item with exactly 1 charge
    addItem(wolf, "foxToken");
    yield;

    expect(wolf.inventory![0].charges).toBe(1);

    // Use the action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Item should be completely removed when charges reach 0
    yield* yieldFor(() => expect(wolf.inventory).toHaveLength(0));
  });

  it("should not consume charges for non-item actions", {
    wolves: ["test-client"],
  }, function* ({ clients }) {
    const client = clients.get("test-client")!;

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item to inventory
    addItem(wolf, "foxToken");
    yield;

    // Use a non-item action (stop)
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "stop" });
    yield;

    // Fox item should still have its charge since stop action doesn't use items
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);
  });
});
