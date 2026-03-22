import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { newUnit } from "../api/unit.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";
import { hasBuff } from "@/shared/api/unit.ts";
import { unitOrder } from "../actions/unitOrder.ts";

afterEach(cleanupTest);

it(
  "crystalSpeed should refresh existing buff instead of stacking",
  function* ({ clients }) {
    const client = clients.get("sheep-player")!;
    const sheep = newUnit("sheep-player", "sheep", 5, 5);
    const crystal = newUnit("sheep-player", "crystal", 5, 6);
    crystal.progress = undefined;
    crystal.mana = 200;
    crystal.maxMana = 200;

    yield;

    // First cast
    unitOrder(client, {
      type: "unitOrder",
      units: [crystal.id],
      order: "crystalSpeed",
      target: sheep.id,
    });

    yield* yieldFor(() => expect(hasBuff(sheep, "Gemstride")).toBe(true));
    expect(sheep.buffs).toHaveLength(1);

    // Wait for some duration to pass
    yield* yieldFor(5);
    expect(sheep.buffs![0].remainingDuration).toBeCloseTo(15);

    // Cast again
    unitOrder(client, {
      type: "unitOrder",
      units: [crystal.id],
      order: "crystalSpeed",
      target: sheep.id,
    });

    yield* yieldFor(() =>
      expect(sheep.buffs![0].remainingDuration).toBeCloseTo(20)
    );

    expect(sheep.buffs).toHaveLength(1);
  },
);

it(
  "crystalInvisibility should refresh existing buff instead of stacking",
  function* ({ clients }) {
    const client = clients.get("sheep-player")!;
    const sheep = newUnit("sheep-player", "sheep", 5, 5);
    const crystal = newUnit("sheep-player", "crystal", 5, 6);
    crystal.progress = undefined;
    crystal.mana = 200;
    crystal.maxMana = 200;

    yield;

    // First cast
    unitOrder(client, {
      type: "unitOrder",
      units: [crystal.id],
      order: "crystalInvisibility",
      target: sheep.id,
    });

    yield* yieldFor(() => expect(hasBuff(sheep, "Invisibility")).toBe(true));
    expect(sheep.buffs).toHaveLength(1);

    // Wait for some duration
    yield* yieldFor(5);

    // Cast again
    unitOrder(client, {
      type: "unitOrder",
      units: [crystal.id],
      order: "crystalInvisibility",
      target: sheep.id,
    });

    yield* yieldFor(() =>
      expect(sheep.buffs![0].remainingDuration).toBeCloseTo(60)
    );

    expect(sheep.buffs).toHaveLength(1);
  },
);
