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
  it("is night at start", () => {
    expect(computeIsNight(0)).toBe(true);
  });

  it("initial night lasts 6 seconds", () => {
    expect(computeIsNight(5)).toBe(true);
    expect(computeIsNight(6)).toBe(false);
  });

  it("initial day lasts 120 seconds", () => {
    expect(computeIsNight(6)).toBe(false);
    expect(computeIsNight(125)).toBe(false);
    expect(computeIsNight(126)).toBe(true);
  });

  it("cycles between night and day", () => {
    // First night cycle: 126 to 201
    expect(computeIsNight(126)).toBe(true);
    expect(computeIsNight(200)).toBe(true);
    expect(computeIsNight(201)).toBe(false);

    // Second day: 201 to 321
    expect(computeIsNight(320)).toBe(false);
    expect(computeIsNight(321)).toBe(true);
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
