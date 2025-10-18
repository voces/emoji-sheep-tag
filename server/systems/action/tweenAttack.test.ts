import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderAttack } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { yieldFor } from "../../testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "wolf should not loop infinitely when attacking with continuous repathing",
  { wolves: ["player-1"], sheep: ["player-0"] },
  function* () {
    newUnit("player-1", "wolf", 40.77, 33.05);
    const sheep = newUnit("player-0", "sheep", 45, 31);

    // Create corner fences that force pathing around
    newUnit("player-0", "fence", 41.25, 33.75);
    newUnit("player-0", "fence", 41.25, 34.25);
    newUnit("player-0", "fence", 38.75, 33.75);

    // Track "Over 10 order loops" warnings
    let loopWarningCount = 0;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" && args[0].includes("Over 10 order loops")
      ) {
        loopWarningCount++;
        console.log("Loop detected in test:", ...args);
      }
      originalWarn(...args);
    };

    // Run until sheep is killed - wolf should auto-attack
    yield* yieldFor(() => {
      expect(sheep.health).toBe(0);
    }, { timeout: 20 });

    console.warn = originalWarn;

    expect(loopWarningCount).toBe(0);
  },
);

it(
  "wolf should attack-move to a point and acquire targets along the way",
  { wolves: ["player-1"], sheep: ["player-0"] },
  function* () {
    const wolf = newUnit("player-1", "wolf", 40, 30);
    const hut = newUnit("player-0", "hut", 50, 30);

    // Issue attack-move command to a point past the hut
    orderAttack(wolf, { x: 55, y: 30 });

    // Wolf should have attackMove order
    expect(wolf.order?.type).toBe("attackMove");

    // Wait for wolf to acquire the hut as a target
    yield* yieldFor(() => {
      expect(wolf.order?.type).toBe("attackMove");
      expect("targetId" in wolf.order! && wolf.order.targetId).toBe(hut.id);
    }, { timeout: 5 });

    // Wait for hut to be destroyed
    yield* yieldFor(() => {
      expect(hut.health).toBe(0);
    }, { timeout: 10 });
  },
);

it(
  "wolf should directly attack a targeted enemy",
  { wolves: ["player-1"], sheep: ["player-0"] },
  function* () {
    const wolf = newUnit("player-1", "wolf", 40, 30);
    const hut = newUnit("player-0", "hut", 41, 30);

    // Directly attack the hut
    orderAttack(wolf, hut);

    // Wolf should have attack order with targetId
    expect(wolf.order?.type).toBe("attack");
    expect("targetId" in wolf.order! && wolf.order.targetId).toBe(hut.id);

    // Wait for hut to be destroyed
    yield* yieldFor(() => {
      expect(hut.health).toBe(0);
    }, { timeout: 10 });
  },
);

it(
  "frost castle should create ground attack order",
  { wolves: ["player-1"], sheep: ["player-0"] },
  () => {
    const castle = newUnit("player-1", "frostCastle", 40, 30);

    // Attack ground within range (castle range is 5) - use isGroundAttack=true
    const result = orderAttack(castle, { x: 43, y: 30 }, false, true);

    // Order should be successfully created
    expect(result).toBe(true);

    // Castle should have attack order with target (ground, not targetId)
    expect(castle.order?.type).toBe("attack");
    expect("target" in castle.order!).toBe(true);
    expect("targetId" in castle.order!).toBe(false);
    if ("target" in castle.order!) {
      expect(castle.order.target).toEqual({ x: 43, y: 30 });
    }
  },
);

it(
  "frost castle should do nothing when using regular attack on ground with no enemies",
  { wolves: ["player-1"], sheep: ["player-0"] },
  () => {
    const castle = newUnit("player-1", "frostCastle", 40, 30);

    // Use regular attack on empty ground
    const result = orderAttack(castle, { x: 43, y: 30 }, false, false);

    // Order should not be created (no valid target found)
    expect(result).toBe(false);
    expect(castle.order).toBeUndefined();
  },
);
