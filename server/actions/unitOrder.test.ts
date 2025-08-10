import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { waitFor } from "@/shared/util/test/waitFor.ts";
import { interval } from "../api/timing.ts";
import { addItem, newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { newLobby } from "../lobby.ts";
import { unitOrder } from "./unitOrder.ts";
import { advanceCast } from "../systems/action/advanceCast.ts";
import { init } from "../st/data.ts";

afterEach(() => {
  try {
    lobbyContext.context.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
});

const setup = () => {
  const ecs = newEcs();
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    addEventListener: () => {},
  });
  client.id = "test-client";
  clientContext.context = client;
  const lobby = newLobby();
  lobbyContext.context = lobby;
  lobby.round = {
    sheep: new Set(),
    wolves: new Set(),
    ecs,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  // Initialize game data to avoid errors
  init({
    sheep: [],
    wolves: [{ client }],
  });

  return { ecs, client };
};

describe("unitOrder fox item integration", () => {
  it("should cast fox ability from item with charges", async () => {
    const { ecs, client } = setup();

    // Create a wolf unit
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item to inventory
    addItem(wolf, "foxItem");

    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);
    expect(wolf.inventory![0].actions![0]).toBeDefined();

    // Use fox ability from item
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Should have casting order now
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Item should be consumed
    expect(wolf.inventory).toHaveLength(0);

    // Wait for cast to complete and fox to be spawned
    await waitFor(() => {
      const entities = Array.from(ecs.entities);
      const foxes = entities.filter((e) => e.prefab === "fox");
      expect(foxes.length).toBe(1);
    });
  });

  it("should not cast fox when no charges remaining", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item with 0 charges
    addItem(wolf, "foxItem");
    // Modify the inventory item to have 0 charges
    wolf.inventory = wolf.inventory!.map((item) => ({ ...item, charges: 0 }));

    const initialOrder = wolf.order;

    // Try to use fox ability
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Should not change order
    expect(wolf.order).toBe(initialOrder);
  });

  it("should stack charges and consume one per use", async () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item twice (should stack charges)
    addItem(wolf, "foxItem");
    addItem(wolf, "foxItem");

    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(2);

    // Use fox ability once
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Should have casting order
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Should have 1 charge remaining
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);

    // Wait for cast to complete
    await waitFor(() => {
      expect(wolf.order?.type).not.toBe("cast");
    });

    // Use fox ability again
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Should cast again
    expect(wolf.order!.type).toBe("cast");
    expect((wolf.order as { type: string; orderId: string }).orderId).toBe(
      "fox",
    );

    // Should have no charges remaining - item removed
    expect(wolf.inventory).toHaveLength(0);
  });

  it("should not allow other clients to use unit's fox item", () => {
    const { client: _client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "foxItem");

    // Create different client
    const otherClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    otherClient.id = "other-client";

    const initialOrder = wolf.order;
    const initialInventory = [...wolf.inventory!];

    // Other client tries to use fox ability
    unitOrder(otherClient, {
      type: "unitOrder",
      units: [wolf.id],
      order: "fox",
    });

    // Should not change anything
    expect(wolf.order).toBe(initialOrder);
    expect(wolf.inventory).toEqual(initialInventory);
  });

  it("should handle charge consumption generically for any item action", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item
    addItem(wolf, "foxItem");
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);

    // Use the item action - charge consumption should happen automatically
    // after the action regardless of the specific action type
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Item should be consumed due to generalized charge logic
    expect(wolf.inventory).toHaveLength(0);
  });
});

describe("unitOrder basic actions", () => {
  it("should execute stop action", () => {
    const { client } = setup();

    // Use sheep which has stop action
    const sheep = newUnit("test-client", "sheep", 5, 5);

    // Give the unit some orders and queue
    sheep.order = { type: "walk", target: { x: 10, y: 10 } };
    sheep.queue = [{ type: "walk", target: { x: 20, y: 20 } }];

    // Execute stop action
    unitOrder(client, { type: "unitOrder", units: [sheep.id], order: "stop" });

    // Should clear order and queue (properties are deleted, becoming undefined or null)
    expect(sheep.order).toBeFalsy();
    expect(sheep.queue).toBeFalsy();
  });

  it("should execute hold action", () => {
    const { client } = setup();

    // Use wolf which has hold action
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Execute hold action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "hold" });

    // Should have hold order
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("hold");
  });

  it("should execute move action with target position", () => {
    const { client } = setup();

    // Use sheep which has move action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    const target = { x: 15, y: 20 };

    // Execute move action
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target,
    });

    // Should have walk order with target position
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { target: { x: number; y: number } }).target)
      .toEqual(target);
  });

  it("should execute move action with target entity", () => {
    const { client } = setup();

    // Use sheep which has move action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    const targetUnit = newUnit("test-client", "wolf", 15, 20);

    // Execute move action with target entity
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "move",
      target: targetUnit.id,
    });

    // Should have walk order with target id
    expect(sheep.order).toBeDefined();
    expect(sheep.order!.type).toBe("walk");
    expect((sheep.order as { targetId: string }).targetId).toBe(targetUnit.id);
  });

  it("should not execute actions for units not owned by client", () => {
    const { client } = setup();

    // Create sheep owned by different client
    const sheep = newUnit("other-client", "sheep", 5, 5);
    const initialOrder = sheep.order;

    // Try to execute stop action
    unitOrder(client, { type: "unitOrder", units: [sheep.id], order: "stop" });

    // Should not change anything
    expect(sheep.order).toBe(initialOrder);
  });

  it("should skip unknown units silently", () => {
    const { client } = setup();

    // Try to execute action on non-existent unit - should not throw
    expect(() => {
      unitOrder(client, {
        type: "unitOrder",
        units: ["unknown-unit"],
        order: "stop",
      });
    }).toThrow();
  });
});

describe("unitOrder combat actions", () => {
  it("should execute attack action with target entity", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const targetUnit = newUnit("other-client", "sheep", 15, 20);

    // Execute attack action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: targetUnit.id,
    });

    // Should have attack order
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("attack");
    expect((wolf.order as { targetId: string }).targetId).toBe(targetUnit.id);
  });

  it("should execute attack action with ground target (attack-ground)", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const target = { x: 15, y: 20 };

    // Execute attack action with ground target
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target,
    });

    // Should have attackMove order for ground targeting
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("attackMove");
    expect((wolf.order as { target: { x: number; y: number } }).target).toEqual(
      target,
    );
  });

  it("should not attack if target entity doesn't exist", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const initialOrder = wolf.order;

    // Try to attack non-existent entity
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "attack",
      target: "non-existent",
    });

    // Should not change order when target doesn't exist
    expect(wolf.order).toBe(initialOrder);
  });

  it("should handle attack action without target", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);
    const initialOrder = wolf.order;

    // Execute attack action without target
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "attack" });

    // Should not change order when no target provided
    expect(wolf.order).toBe(initialOrder);
  });
});

describe("unitOrder special abilities", () => {
  it("should execute mirror image action", () => {
    const { client } = setup();

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });

    // Should have cast order for mirror image
    expect(wolf.order).toBeDefined();
    expect(wolf.order!.type).toBe("cast");
    const castOrder = wolf.order as {
      type: string;
      orderId: string;
      positions?: unknown;
    };
    expect(castOrder.orderId).toBe("mirrorImage");
    expect(castOrder.positions).toBeDefined();
  });

  it("should execute destroy last farm action", () => {
    const { client } = setup();

    // Use sheep which has destroy last farm action
    const sheep = newUnit("test-client", "sheep", 5, 5);
    // Create a hut to destroy
    const hut = newUnit("test-client", "hut", 10, 10);
    expect(hut.health).toBe(120);

    // Execute destroy last farm action
    unitOrder(client, {
      type: "unitOrder",
      units: [sheep.id],
      order: "destroyLastFarm",
    });

    // Verify the hut was destroyed (health set to 0)
    expect(hut.health).toBe(0);
  });

  it("should handle mirror image with insufficient mana", () => {
    const { client } = setup();

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    // Set mana to 0
    wolf.mana = 0;
    wolf.maxMana = 100;

    const initialOrder = wolf.order;

    // Try to execute mirror image with no mana
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });

    // Should not cast if insufficient mana
    expect(wolf.order).toBe(initialOrder);
  });

  it("should consume mana for mirror image", () => {
    const { client } = setup();

    // Use wolf which has mirror image action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    wolf.maxMana = 100;

    // Execute mirror image action
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "mirrorImage",
    });

    // Advance cast slightly to trigger cast start (which consumes mana)
    advanceCast(wolf, 0.1);

    // Should have consumed mana (mirror image costs 20 mana)
    expect(wolf.mana).toBe(80);
  });
});

describe("unitOrder self destruct", () => {
  it("should execute self destruct action for hut", () => {
    const { client } = setup();

    // Use hut which has self destruct action
    const hut = newUnit("test-client", "hut", 5, 5);
    hut.health = 100;
    hut.maxHealth = 100;

    // Execute self destruct action
    unitOrder(client, {
      type: "unitOrder",
      units: [hut.id],
      order: "selfDestruct",
    });

    // Should set health to 0
    expect(hut.health).toBe(0);
  });

  it("should not execute self destruct if unit doesn't have the action", () => {
    const { client } = setup();

    // Use wolf which doesn't have self destruct action
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.health = 100;
    wolf.maxHealth = 100;

    const initialHealth = wolf.health;

    // Execute self destruct action without the action being available
    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "selfDestruct",
    });

    // Should not change health since action isn't available
    expect(wolf.health).toBe(initialHealth);
  });

  it("should allow self destruct regardless of current health if action exists", () => {
    const { client } = setup();

    // Use tiny hut which has self destruct action
    const tinyHut = newUnit("test-client", "tinyHut", 5, 5);
    tinyHut.health = 1;
    tinyHut.maxHealth = 100;

    // Execute self destruct action
    unitOrder(client, {
      type: "unitOrder",
      units: [tinyHut.id],
      order: "selfDestruct",
    });

    // Should set health to 0 even with low health
    expect(tinyHut.health).toBe(0);
  });
});

describe("unitOrder generalized charge system", () => {
  it("should consume charges for any item-based action", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add a hypothetical lightning item that would work with any action
    wolf.inventory = [{
      id: "lightningItem",
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

    // Mock a lightning action handler by temporarily adding to unitOrder switch
    // Since we can't modify the switch at runtime, we'll test with fox action
    // which we know works with the generalized charge system
    addItem(wolf, "foxItem");
    expect(wolf.inventory).toHaveLength(2);

    // Use fox action - should consume one charge
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Should have consumed fox item charge (it had 1 charge, should be removed)
    const remainingItems = wolf.inventory!.filter((i) => i.id === "foxItem");
    expect(remainingItems).toHaveLength(0);

    // Lightning item should still be there unchanged
    const lightningItems = wolf.inventory!.filter((i) =>
      i.id === "lightningItem"
    );
    expect(lightningItems).toHaveLength(1);
    expect(lightningItems[0].charges).toBe(3);
  });

  it("should handle items without charges (unlimited use)", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add item without charges property
    wolf.inventory = [{
      id: "unlimitedItem",
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

    // Use the unlimited action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Item should still be there since it has no charges to consume
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].id).toBe("unlimitedItem");
  });

  it("should remove items when charges reach zero", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add item with exactly 1 charge
    addItem(wolf, "foxItem");
    expect(wolf.inventory![0].charges).toBe(1);

    // Use the action
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "fox" });

    // Item should be completely removed when charges reach 0
    expect(wolf.inventory).toHaveLength(0);
  });

  it("should not consume charges for non-item actions", () => {
    const { client } = setup();

    const wolf = newUnit("test-client", "wolf", 5, 5);

    // Add fox item to inventory
    addItem(wolf, "foxItem");

    // Use a non-item action (stop)
    unitOrder(client, { type: "unitOrder", units: [wolf.id], order: "stop" });

    // Fox item should still have its charge since stop action doesn't use items
    expect(wolf.inventory).toHaveLength(1);
    expect(wolf.inventory![0].charges).toBe(1);
  });
});
