import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { newUnit } from "../api/unit.ts";
import { prefabs } from "@/shared/data.ts";
import { computeIsNight, isNight } from "@/shared/dayNight.ts";
import { computeUnitSightRadius } from "@/shared/api/unit.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";

afterEach(cleanupTest);

describe("computeIsNight", () => {
  it("is day at start", () => {
    expect(computeIsNight(0)).toBe(false);
  });

  it("transitions to night and back", () => {
    // Find the first night boundary by scanning
    let firstNight = -1;
    for (let t = 0; t < 300; t++) {
      if (computeIsNight(t)) {
        firstNight = t;
        break;
      }
    }
    expect(firstNight).toBeGreaterThan(0);
    expect(computeIsNight(firstNight - 1)).toBe(false);

    // Night lasts 75s
    expect(computeIsNight(firstNight + 74)).toBe(true);
    expect(computeIsNight(firstNight + 75)).toBe(false);

    // Day lasts 120s, then night again
    expect(computeIsNight(firstNight + 75 + 119)).toBe(false);
    expect(computeIsNight(firstNight + 75 + 120)).toBe(true);
  });
});

describe("day/night with timer", () => {
  const addSurvivalTimer = (duration: number) =>
    addEntity({
      isTimer: true,
      buffs: [{
        expiration: "Time until sheep win:",
        remainingDuration: duration,
        totalDuration: duration,
      }],
    });

  it(
    "computes effective sight radius during night",
    function* () {
      addSurvivalTimer(300);
      const sheep = newUnit("sheep-player", "sheep", 5, 5);
      const baseSightRadius = prefabs.sheep.sightRadius!;

      // Advance past initial day into night
      yield* yieldFor(() => expect(isNight()).toBe(true), { timeout: 200 });

      expect(computeUnitSightRadius(sheep)).toBe(baseSightRadius * 0.8);
      expect(sheep.sightRadius).toBe(baseSightRadius);
    },
  );

  it(
    "restores effective sight radius during day",
    function* () {
      addSurvivalTimer(300);
      const sheep = newUnit("sheep-player", "sheep", 5, 5);
      const baseSightRadius = prefabs.sheep.sightRadius!;

      // Advance into night
      yield* yieldFor(() => expect(isNight()).toBe(true), { timeout: 200 });
      expect(computeUnitSightRadius(sheep)).toBe(baseSightRadius * 0.8);

      // Advance back to day (night lasts 75s)
      yield* yieldFor(() => expect(isNight()).toBe(false), { timeout: 200 });
      expect(computeUnitSightRadius(sheep)).toBe(baseSightRadius);
    },
  );
});
