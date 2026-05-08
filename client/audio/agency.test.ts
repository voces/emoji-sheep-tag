import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  type AgencyEvents,
  computeSheepAgencyValue,
  computeWolfAgencyValue,
  createAgencyEvents,
  expectedStructuresPerSheep,
  pruneAgencyEvents,
  recordKill,
  recordProximity,
  recordRescue,
  type SheepAgencyParams,
  type WolfAgencyParams,
} from "./agency.ts";

const SHEEP_ID = "sheep-A";
const ALLY_ID = "sheep-B";
const WOLF_ID = "wolf-A";
const NOW = 1_000_000;

const sheepParams = (
  overrides: Partial<SheepAgencyParams> = {},
): SheepAgencyParams => ({
  unitId: SHEEP_ID,
  livingSheep: 4,
  totalSheep: 4,
  roundProgress: 0,
  elapsedSeconds: 0,
  unitStructures: 0,
  teamStructures: 0,
  now: NOW,
  ...overrides,
});

const wolfParams = (
  overrides: Partial<WolfAgencyParams> = {},
): WolfAgencyParams => ({
  unitId: WOLF_ID,
  livingSheep: 4,
  totalSheep: 4,
  roundProgress: 0,
  elapsedSeconds: 0,
  teamStructures: 0,
  now: NOW,
  ...overrides,
});

// Each sheep, fed expected structures at the expected pace, contributes 0
// from the structure terms — the round starts in this calibrated state.
const calibratedStructures = (
  livingSheep: number,
  elapsedSeconds: number,
) => {
  const unit = expectedStructuresPerSheep(elapsedSeconds);
  return {
    unitStructures: unit,
    teamStructures: unit * livingSheep,
  };
};

describe("expectedStructuresPerSheep", () => {
  it("returns 0 before any time has passed", () => {
    expect(expectedStructuresPerSheep(0)).toBe(0);
  });

  it("hits 80 at one minute (the first-minute target)", () => {
    expect(expectedStructuresPerSheep(60)).toBeCloseTo(80, 5);
  });

  it("adds 56 in minute 2 (70% of 80) for total 136", () => {
    expect(expectedStructuresPerSheep(120)).toBeCloseTo(136, 1);
  });

  it("adds ~39 more in minute 3 for total ~175", () => {
    expect(expectedStructuresPerSheep(180)).toBeCloseTo(175.2, 1);
  });

  it("approaches the 266.67 asymptote in late minutes", () => {
    expect(expectedStructuresPerSheep(60 * 30)).toBeCloseTo(266.67, 1);
  });
});

describe("sheep agency: living-count base", () => {
  it("is positive when the team is intact (no other inputs)", () => {
    const events = createAgencyEvents();
    const a = computeSheepAgencyValue(events, sheepParams());
    expect(a).toBeGreaterThan(0);
  });

  it("goes negative once the team is half-dead", () => {
    const events = createAgencyEvents();
    const a = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 2, totalSheep: 4 }),
    );
    expect(a).toBeLessThan(0);
  });

  it("goes deeply negative when most of the team is dead", () => {
    const events = createAgencyEvents();
    const a = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 1, totalSheep: 4 }),
    );
    expect(a).toBeLessThan(-0.3);
  });
});

describe("sheep agency: convex-on-dead-fraction scaling", () => {
  it("treats the first death in a 5v5 as a small impact", () => {
    const events = createAgencyEvents();
    const full = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 5, totalSheep: 5 }),
    );
    const oneDead = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 4, totalSheep: 5 }),
    );
    const drop = full - oneDead;
    expect(drop).toBeGreaterThan(0);
    expect(drop).toBeLessThan(0.15);
  });

  it("makes the second death in a 5v5 quite bad (>3× the first-death drop)", () => {
    const events = createAgencyEvents();
    const full = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 5, totalSheep: 5 }),
    );
    const oneDead = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 4, totalSheep: 5 }),
    );
    const twoDead = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 3, totalSheep: 5 }),
    );
    const firstDrop = full - oneDead;
    const secondDrop = oneDead - twoDead;
    expect(secondDrop / firstDrop).toBeGreaterThan(3);
  });

  it("punishes the same absolute death count more in smaller teams", () => {
    const events = createAgencyEvents();
    const smallTeam = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 1, totalSheep: 2 }),
    );
    const bigTeam = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 4, totalSheep: 5 }),
    );
    // One death in 2v2 should hurt much more than one death in 5v5.
    expect(smallTeam).toBeLessThan(bigTeam);
    expect(bigTeam - smallTeam).toBeGreaterThan(0.5);
  });

  it("treats 1v1 1-dead as terminal (clamps the alive term to its floor)", () => {
    const events = createAgencyEvents();
    const dead = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 0, totalSheep: 1 }),
    );
    const big = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 0, totalSheep: 5 }),
    );
    // Both saturate the alive term — agency from this contribution alone is identical.
    expect(dead).toBeCloseTo(big, 6);
  });
});

describe("round progress", () => {
  it("nudges sheep agency UP late in the round", () => {
    const events = createAgencyEvents();
    const early = computeSheepAgencyValue(
      events,
      sheepParams({ roundProgress: 0 }),
    );
    const late = computeSheepAgencyValue(
      events,
      sheepParams({ roundProgress: 1 }),
    );
    expect(late).toBeGreaterThan(early);
  });

  it("hits wolves harder than sheep", () => {
    const events = createAgencyEvents();
    const sheepEarly = computeSheepAgencyValue(
      events,
      sheepParams({ roundProgress: 0 }),
    );
    const sheepLate = computeSheepAgencyValue(
      events,
      sheepParams({ roundProgress: 1 }),
    );
    const wolfEarly = computeWolfAgencyValue(
      events,
      wolfParams({ roundProgress: 0 }),
    );
    const wolfLate = computeWolfAgencyValue(
      events,
      wolfParams({ roundProgress: 1 }),
    );
    const sheepDelta = sheepLate - sheepEarly;
    const wolfDelta = wolfEarly - wolfLate;
    expect(wolfDelta).toBeGreaterThan(sheepDelta);
  });
});

describe("kill spike (wolf catches sheep)", () => {
  it("hits the killed sheep harder than allies (both still take a hit)", () => {
    const noKill = createAgencyEvents();
    const baseline = computeSheepAgencyValue(noKill, sheepParams());
    const events = createAgencyEvents();
    recordKill(events, SHEEP_ID, NOW);
    const own = computeSheepAgencyValue(events, sheepParams());
    const ally = computeSheepAgencyValue(
      events,
      sheepParams({ unitId: ALLY_ID }),
    );
    expect(own).toBeLessThan(ally);
    expect(ally).toBeLessThan(baseline);
    expect(baseline - own).toBeGreaterThan(2 * (baseline - ally));
  });

  it("decays to 5–10% of the spike around 90s post-kill", () => {
    const fresh = createAgencyEvents();
    recordKill(fresh, SHEEP_ID, NOW);
    const baselineA = computeSheepAgencyValue(fresh, sheepParams());

    const stale = createAgencyEvents();
    recordKill(stale, SHEEP_ID, NOW - 90_000);
    const lateA = computeSheepAgencyValue(stale, sheepParams());

    // No-kill baseline (subtract to isolate the kill contribution).
    const empty = createAgencyEvents();
    const noKillA = computeSheepAgencyValue(empty, sheepParams());

    const freshContribution = noKillA - baselineA;
    const lateContribution = noKillA - lateA;
    const ratio = lateContribution / freshContribution;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.10);
  });

  it("falls back to a uniform wolf spike when the killer is unknown", () => {
    const events = createAgencyEvents();
    recordKill(events, SHEEP_ID, NOW); // no killerId
    const wolfA = computeWolfAgencyValue(events, wolfParams());
    const wolfB = computeWolfAgencyValue(
      events,
      wolfParams({ unitId: "wolf-B" }),
    );
    expect(wolfA).toBeCloseTo(wolfB, 6);
    expect(wolfA).toBeGreaterThan(
      computeWolfAgencyValue(createAgencyEvents(), wolfParams()),
    );
  });

  it("rewards the killer wolf more than assisting wolves", () => {
    const events = createAgencyEvents();
    recordKill(events, SHEEP_ID, NOW, WOLF_ID);
    const empty = createAgencyEvents();
    const baseline = computeWolfAgencyValue(empty, wolfParams());
    const killer = computeWolfAgencyValue(events, wolfParams());
    const assist = computeWolfAgencyValue(
      events,
      wolfParams({ unitId: "wolf-B" }),
    );
    expect(killer).toBeGreaterThan(assist);
    expect(assist).toBeGreaterThan(baseline);
    // Killer gets 2× the assist boost.
    const killerDelta = killer - baseline;
    const assistDelta = assist - baseline;
    expect(killerDelta / assistDelta).toBeGreaterThan(1.5);
  });
});

describe("rescue spike", () => {
  it("boosts the rescued sheep more than allies, but only modestly more", () => {
    const events = createAgencyEvents();
    recordRescue(events, SHEEP_ID, NOW);
    const empty = createAgencyEvents();
    const baseline = computeSheepAgencyValue(empty, sheepParams());
    const own = computeSheepAgencyValue(events, sheepParams());
    const ally = computeSheepAgencyValue(
      events,
      sheepParams({ unitId: ALLY_ID }),
    );
    const ownDelta = own - baseline;
    const allyDelta = ally - baseline;
    expect(ownDelta).toBeGreaterThan(allyDelta);
    expect(allyDelta).toBeGreaterThan(0);
    // The two contributions are close (0.35 vs 0.25): own / ally < 2×.
    expect(ownDelta / allyDelta).toBeLessThan(2);
  });

  it("drops wolves uniformly on a rescue", () => {
    const events = createAgencyEvents();
    recordRescue(events, SHEEP_ID, NOW);
    const wolfA = computeWolfAgencyValue(events, wolfParams());
    const wolfB = computeWolfAgencyValue(
      events,
      wolfParams({ unitId: "wolf-B" }),
    );
    expect(wolfA).toBeCloseTo(wolfB, 6);
    expect(wolfA).toBeLessThan(
      computeWolfAgencyValue(createAgencyEvents(), wolfParams()),
    );
  });
});

describe("structures vs expected", () => {
  it("contributes ~zero when both per-unit and team are at expected", () => {
    const events = createAgencyEvents();
    const elapsed = 90;
    const calibrated = calibratedStructures(4, elapsed);
    // Reference: build phase (elapsed=0, expected=0 → no structure terms).
    const reference = computeSheepAgencyValue(
      events,
      sheepParams({ elapsedSeconds: 0 }),
    );
    const calibratedA = computeSheepAgencyValue(
      events,
      sheepParams({ elapsedSeconds: elapsed, ...calibrated }),
    );
    expect(Math.abs(calibratedA - reference)).toBeLessThan(0.01);
  });

  it("boosts sheep when the team is over-building", () => {
    const events = createAgencyEvents();
    const elapsed = 90;
    const calibrated = calibratedStructures(4, elapsed);
    const baseline = computeSheepAgencyValue(
      events,
      sheepParams({ elapsedSeconds: elapsed, ...calibrated }),
    );
    const heavy = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: calibrated.unitStructures * 2,
        teamStructures: calibrated.teamStructures * 2,
      }),
    );
    expect(heavy).toBeGreaterThan(baseline);
  });

  it("hurts sheep and benefits wolves when under-built", () => {
    const events = createAgencyEvents();
    const elapsed = 90;
    const calibrated = calibratedStructures(4, elapsed);
    const sheepBase = computeSheepAgencyValue(
      events,
      sheepParams({ elapsedSeconds: elapsed, ...calibrated }),
    );
    const sheepThin = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: calibrated.unitStructures / 2,
        teamStructures: calibrated.teamStructures / 2,
      }),
    );
    const wolfBase = computeWolfAgencyValue(
      events,
      wolfParams({
        elapsedSeconds: elapsed,
        teamStructures: calibrated.teamStructures,
      }),
    );
    const wolfRich = computeWolfAgencyValue(
      events,
      wolfParams({
        elapsedSeconds: elapsed,
        teamStructures: calibrated.teamStructures / 2,
      }),
    );
    expect(sheepThin).toBeLessThan(sheepBase);
    expect(wolfRich).toBeGreaterThan(wolfBase);
  });

  it("a slacker sheep gets less agency than an on-pace teammate on the same team", () => {
    const events = createAgencyEvents();
    const elapsed = 90;
    const calibrated = calibratedStructures(4, elapsed);
    // Same team-wide total, but local sheep has built nothing.
    const slacker = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: 0,
        teamStructures: calibrated.teamStructures,
      }),
    );
    // Same team-wide total, this sheep is on pace.
    const onPace = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: calibrated.unitStructures,
        teamStructures: calibrated.teamStructures,
      }),
    );
    expect(slacker).toBeLessThan(onPace);
  });

  it("weighs the per-unit and team factors evenly", () => {
    const events = createAgencyEvents();
    const elapsed = 90;
    const calibrated = calibratedStructures(4, elapsed);
    const baseline = computeSheepAgencyValue(
      events,
      sheepParams({ elapsedSeconds: elapsed, ...calibrated }),
    );
    // Symmetric stress on each factor: per-unit at 50%, team-on-track.
    const localOnly = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: calibrated.unitStructures / 2,
        teamStructures: calibrated.teamStructures,
      }),
    );
    // Per-unit on track, team at 50%.
    const teamOnly = computeSheepAgencyValue(
      events,
      sheepParams({
        elapsedSeconds: elapsed,
        unitStructures: calibrated.unitStructures,
        teamStructures: calibrated.teamStructures / 2,
      }),
    );
    const localDelta = baseline - localOnly;
    const teamDelta = baseline - teamOnly;
    expect(Math.abs(localDelta - teamDelta)).toBeLessThan(0.001);
  });
});

describe("proximity history", () => {
  const sampleAt = (
    events: AgencyEvents,
    unitId: string,
    values: number[],
    now: number,
  ) => {
    // Spread samples uniformly across the last 30 seconds.
    values.forEach((v, i) =>
      recordProximity(events, unitId, v, now - i * 1000)
    );
  };

  it("rewards sheep when the wolf never got close (low peak)", () => {
    const events = createAgencyEvents();
    sampleAt(events, SHEEP_ID, Array(30).fill(0), NOW);
    const calm = computeSheepAgencyValue(events, sheepParams());
    const empty = computeSheepAgencyValue(
      createAgencyEvents(),
      sheepParams(),
    );
    expect(calm).toBeGreaterThan(empty);
  });

  it("penalizes sheep when the wolf got close (high peak)", () => {
    const events = createAgencyEvents();
    sampleAt(events, SHEEP_ID, Array(30).fill(0.9), NOW);
    const tense = computeSheepAgencyValue(events, sheepParams());
    const empty = computeSheepAgencyValue(
      createAgencyEvents(),
      sheepParams(),
    );
    expect(tense).toBeLessThan(empty);
  });

  it("a brief spike beats a calm average (max-biased aggregator)", () => {
    const calmEvents = createAgencyEvents();
    sampleAt(calmEvents, SHEEP_ID, Array(30).fill(0.3), NOW);
    const spikedEvents = createAgencyEvents();
    const spikedSamples = Array(30).fill(0);
    spikedSamples[0] = 0.9; // one moment of danger
    spikedSamples[1] = 0.9;
    spikedSamples[2] = 0.9;
    sampleAt(spikedEvents, SHEEP_ID, spikedSamples, NOW);
    const calm = computeSheepAgencyValue(calmEvents, sheepParams());
    const spiked = computeSheepAgencyValue(spikedEvents, sheepParams());
    // Arithmetic mean would say spiked < calm (0.09 vs 0.30); the
    // peak-biased aggregator should flip that — close calls dominate.
    expect(spiked).toBeLessThan(calm);
  });

  it("mirrors the sign for wolves (close = good for wolf)", () => {
    const events = createAgencyEvents();
    sampleAt(events, WOLF_ID, Array(30).fill(0.9), NOW);
    const tense = computeWolfAgencyValue(events, wolfParams());
    const empty = computeWolfAgencyValue(createAgencyEvents(), wolfParams());
    expect(tense).toBeGreaterThan(empty);
  });

  it("ignores samples older than the 60s window", () => {
    const events = createAgencyEvents();
    // Old close calls — outside the 60s window.
    sampleAt(events, SHEEP_ID, Array(10).fill(0.9), NOW - 90_000);
    const stale = computeSheepAgencyValue(events, sheepParams());
    const empty = computeSheepAgencyValue(
      createAgencyEvents(),
      sheepParams(),
    );
    expect(stale).toBeCloseTo(empty, 6);
  });
});

describe("event pruning", () => {
  it("drops kill / rescue / proximity entries past their windows", () => {
    const events = createAgencyEvents();
    recordKill(events, SHEEP_ID, NOW - 200_000);
    recordKill(events, SHEEP_ID, NOW - 30_000);
    recordRescue(events, SHEEP_ID, NOW - 300_000);
    recordProximity(events, SHEEP_ID, 0.5, NOW - 90_000);
    recordProximity(events, SHEEP_ID, 0.5, NOW - 10_000);
    pruneAgencyEvents(events, NOW);
    expect(events.kills.length).toBe(1);
    expect(events.rescues.length).toBe(0);
    expect(events.proximityHistory.get(SHEEP_ID)?.length).toBe(1);
  });
});

describe("clamping", () => {
  it("clamps the sheep agency below at -1", () => {
    const events = createAgencyEvents();
    // Pile on multiple kill spikes against the local sheep.
    for (let i = 0; i < 5; i++) recordKill(events, SHEEP_ID, NOW - i * 100);
    const a = computeSheepAgencyValue(
      events,
      sheepParams({ livingSheep: 0, totalSheep: 4, roundProgress: 0 }),
    );
    expect(a).toBeGreaterThanOrEqual(-1);
    expect(a).toBe(-1);
  });

  it("clamps the wolf agency above at +1", () => {
    const events = createAgencyEvents();
    for (let i = 0; i < 5; i++) recordKill(events, SHEEP_ID, NOW - i * 100);
    const a = computeWolfAgencyValue(
      events,
      wolfParams({ livingSheep: 0, totalSheep: 4, roundProgress: 1 }),
    );
    expect(a).toBeLessThanOrEqual(1);
    expect(a).toBe(1);
  });
});
