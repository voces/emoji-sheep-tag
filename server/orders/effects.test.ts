import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { addItem, newUnit } from "../api/unit.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";
import { unitOrder } from "../actions/unitOrder.ts";

afterEach(cleanupTest);

it(
  "spawn effect places a unit at the targeted point (sentry)",
  { wolves: ["test-client"] },
  function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    wolf.mana = 100;
    wolf.maxMana = 100;
    yield;

    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "sentry",
      target: { x: 7, y: 5 },
    });

    const sentry = yield* yieldFor(() => {
      const found = Array.from(ecs.entities).find((e) =>
        e.prefab === "sentry" && e.owner === "test-client"
      );
      if (!found) throw new Error("sentry not spawned yet");
      return found;
    });

    expect(sentry.position).toEqual({ x: 7, y: 5 });
  },
);

it(
  "meteor applies its sfx and damage effects",
  { wolves: ["test-client"] },
  function* ({ ecs, clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "bomber");

    const hut = newUnit("test-client", "hut", 6, 5);
    hut.health = 100;
    hut.maxHealth = 100;
    yield;

    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "meteor",
      target: { x: 6, y: 5 },
    });

    // damage effect
    yield* yieldFor(() => expect(hut.health!).toBeLessThan(100));
    expect(hut.health).toBe(50);

    // sfx effect: a transient "meteor" visual is spawned at the target
    expect(
      Array.from(ecs.entities).some((e) => e.model === "meteor"),
    ).toBe(true);
  },
);

it(
  "restoreMana effect refills mana, capped at max (mana potion)",
  { wolves: ["test-client"] },
  function* ({ clients }) {
    const client = clients.get("test-client")!;
    const wolf = newUnit("test-client", "wolf", 5, 5);
    addItem(wolf, "manaPotion");
    wolf.mana = 10;
    wolf.maxMana = 100;
    yield;

    unitOrder(client, {
      type: "unitOrder",
      units: [wolf.id],
      order: "manaPotion",
    });

    yield* yieldFor(() => expect(wolf.mana!).toBeGreaterThan(10));
    expect(wolf.mana).toBe(100);
  },
);
