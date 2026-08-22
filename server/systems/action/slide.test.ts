import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Entity } from "@/shared/types.ts";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { angleDifference } from "@/shared/pathing/math.ts";

afterEach(cleanupTest);

type Point = { x: number; y: number };

/**
 * Ticks taken to place each structure in turn, walking to whatever range each
 * one needs.
 */
function* timeBuilds(
  sheep: Entity,
  prefab: string,
  sites: Point[],
): Generator<void, number, unknown> {
  let ticks = 0;

  for (const site of sites) {
    orderBuild(sheep, prefab, site.x, site.y);
    while (sheep.order && ticks < 600) {
      ticks++;
      yield;
    }
  }

  return ticks;
}

/**
 * A displacement is a slide only if it carries the builder along the wide it is
 * laying: with the first structure already up, filling the wide outward has to
 * beat filling it inward, which it cannot do unless each placement leaves the
 * builder nearer the next site than it started.
 */

/**
 * The eight slides: a full footprint along the wide and one grid step to the
 * side, either way round both axes. World +y is north.
 */
const slides = (width: number, step: number): [string, number, number][] => [
  ["ESe", width, -step],
  ["ENe", width, step],
  ["WSw", -width, -step],
  ["WNw", -width, step],
  ["SSe", step, -width],
  ["SSw", -step, -width],
  ["NNe", step, width],
  ["NNw", -step, width],
];

const GRID_STEP = 0.5;

for (const [prefab, width] of [["cottage", 1.5], ["house", 2]] as const) {
  for (const [label, dx, dy] of slides(width, GRID_STEP)) {
    it(
      `slides a ${prefab} wide ${label}`,
      { sheep: ["player-0"], gold: 400 },
      function* ({ ecs }) {
        const first = { x: 40, y: 30 };
        const second = { x: first.x + dx, y: first.y + dy };
        const third = { x: first.x + dx * 2, y: first.y + dy * 2 };
        const start = { x: first.x - dx, y: first.y - dy };

        const lay = function* (sites: Point[]) {
          for (const e of Array.from(ecs.entities)) {
            if (e.prefab === prefab) ecs.removeEntity(e);
          }

          const sheep = newUnit("player-0", "sheep", start.x, start.y);

          yield;

          // Timing starts with the first of the wide already up, but the sheep
          // lays it so that the run is the same one a player makes.
          yield* timeBuilds(sheep, prefab, [first]);

          const ticks = yield* timeBuilds(sheep, prefab, sites);

          ecs.removeEntity(sheep);

          yield;

          return ticks;
        };

        const outward = yield* lay([second, third]);
        const inward = yield* lay([third, second]);

        // Only that it is faster, not by how much: the builder is set beside
        // the middle of what it just laid rather than carried past the end of
        // it, so the gain is one structure of ground and no more.
        expect(outward).toBeLessThan(inward);
      },
    );
  }
}

/**
 * A builder may travel along a wide — that is the slide — but never across it.
 * Whichever side of the line it is on when a structure goes up, it is still on
 * that side afterwards.
 */
for (const [prefab, width] of [["cottage", 1.5], ["house", 2]] as const) {
  for (const [label, dx, dy] of slides(width, GRID_STEP)) {
    it(
      `keeps the builder on its side of a ${prefab} wide laid ${label}`,
      { sheep: ["player-0"], gold: 400 },
      function* () {
        const first = { x: 40, y: 30 };
        const sheep = newUnit("player-0", "sheep", first.x - dx, first.y - dy);

        yield;

        // Across the wide is the axis it does not run along.
        const across = (at: { x: number; y: number }, site: Point) =>
          Math.abs(dx) > Math.abs(dy) ? at.y - site.y : at.x - site.x;

        const offenders: string[] = [];

        for (let n = 0; n < 4; n++) {
          const site = { x: first.x + dx * n, y: first.y + dy * n };

          orderBuild(sheep, prefab, site.x, site.y);

          // The side that matters is the one it held when the structure went
          // up, which is the last tick it still had the order.
          let before = across(sheep.position!, site);
          for (let tick = 0; tick < 600 && sheep.order; tick++) {
            before = across(sheep.position!, site);
            yield;
          }

          const after = across(sheep.position!, site);

          // A builder standing all but on the line has no side to be kept on,
          // and the turn it is given round a structure is a quarter square. A
          // crossing means going from one side of the wide to the other.
          const sided = Math.min(Math.abs(before), Math.abs(after)) > 0.25;

          if (sided && before * after < 0) {
            offenders.push(
              `#${n} crossed from ${before.toFixed(2)} to ${after.toFixed(2)}`,
            );
          }
        }

        expect(offenders).toEqual([]);
      },
    );
  }
}

/**
 * The builder is set down against what it just built, whichever way it came at
 * it. A corner approach is the one that goes wrong quietly: any slack in the
 * clearance is multiplied by the diagonal, leaving the builder adrift.
 */
for (const [prefab, extent] of [["hut", 0.5], ["cottage", 0.75]] as const) {
  it(`lands the builder against a ${prefab} it just built`, {
    sheep: ["player-0"],
    gold: 400,
  }, function* ({ ecs }) {
    const site = { x: 40, y: 30 };
    const gaps: string[] = [];

    for (let degrees = 0; degrees < 360; degrees += 45) {
      const angle = degrees * Math.PI / 180;
      const sheep = newUnit(
        "player-0",
        "sheep",
        site.x + Math.cos(angle) * 4,
        site.y + Math.sin(angle) * 4,
      );

      yield;

      yield* timeBuilds(sheep, prefab, [site]);

      // Square footprints, so the gap is on whichever axis it cleared by.
      const gap = Math.max(
        Math.abs(sheep.position!.x - site.x),
        Math.abs(sheep.position!.y - site.y),
      ) - extent - 0.25;

      if (gap > 0.1) gaps.push(`${degrees}° -> ${gap.toFixed(2)} adrift`);

      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === prefab || e === sheep) ecs.removeEntity(e);
      }

      yield;
    }

    expect(gaps).toEqual([]);
  });
}

it(
  "does not treat a cottage set corner to corner as a wide",
  { sheep: ["player-0"], gold: 400 },
  function* () {
    // The pair the log caught: a step of (1.25, 1.25) touches corners, which is
    // no line to lay, so the second one must not steer by the first.
    const previous = { x: 43.5, y: 33.5 };
    const site = { x: 44.75, y: 34.75 };

    const sheep = newUnit("player-0", "sheep", previous.x - 3, previous.y - 3);

    yield;

    yield* timeBuilds(sheep, "cottage", [previous]);

    sheep.position = { x: site.x + 3, y: site.y + 3 };

    yield;

    const approach = Math.atan2(
      sheep.position.y - site.y,
      sheep.position.x - site.x,
    );

    yield* timeBuilds(sheep, "cottage", [site]);

    const bearing = Math.atan2(
      sheep.position!.y - site.y,
      sheep.position!.x - site.x,
    );
    const off = Math.abs(angleDifference(bearing, approach)) * 180 / Math.PI;

    expect(off).toBeLessThanOrEqual(45);
  },
);

it(
  "keeps a builder on its own side of a cottage that starts no wide",
  { sheep: ["player-0"], gold: 4000 },
  function* ({ ecs }) {
    for (const site of [{ x: 40, y: 30 }, { x: 30, y: 40 }, { x: 50, y: 50 }]) {
      const offenders: string[] = [];

      // One sheep throughout: each cottage it lays is an earlier build for the
      // next, and a cottage put up elsewhere is not a wide — it must not steer
      // where the following one sets the builder down.
      const sheep = newUnit("player-0", "sheep", 33, 34);

      yield;

      // Angles are jiggled off the exact degree, since a builder that lands on a
      // clean axis can hide a rounding that only shows up just off one.
      for (let degrees = 3; degrees < 360; degrees += 11) {
        const angle = degrees * Math.PI / 180;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        sheep.position = { x: site.x + dx * 4, y: site.y + dy * 4 };

        yield;

        yield* timeBuilds(sheep, "cottage", [site]);

        // The builder has to stay within a quadrant of where it stood: opposite
        // means it crossed ground it never walked, and a corner away means it
        // was shunted a whole footprint sideways.
        const outX = sheep.position!.x - site.x;
        const outY = sheep.position!.y - site.y;
        const bearing = Math.atan2(outY, outX);
        const off = Math.abs(angleDifference(bearing, angle)) * 180 / Math.PI;

        if (off > 45) {
          offenders.push(`${degrees}° -> off by ${Math.round(off)}°`);
        }

        for (const e of Array.from(ecs.entities)) {
          if (e.prefab === "cottage") ecs.removeEntity(e);
        }

        yield;
      }

      expect(offenders).toEqual([]);
    }
  },
);

/**
 * A wide steps one square of the build grid sideways. Two squares over is not
 * one, whatever the structure — the grid does not grow with the footprint, so
 * bounding the step by a fraction of the width let bigger structures slide on
 * offsets that a cottage could not.
 */
for (const [prefab, width] of [["cottage", 1.5], ["house", 2]] as const) {
  it(
    `does not treat two squares over as a ${prefab} wide`,
    { sheep: ["player-0"], gold: 4000 },
    function* () {
      const first = { x: 40, y: 30 };
      const second = { x: first.x + width, y: first.y + 1 };

      const sheep = newUnit("player-0", "sheep", first.x - width, first.y);

      yield;

      yield* timeBuilds(sheep, prefab, [first]);

      const approach = Math.atan2(
        sheep.position!.y - second.y,
        sheep.position!.x - second.x,
      );

      yield* timeBuilds(sheep, prefab, [second]);

      // Off a wide the builder is only pushed clear the way it came, so it
      // stays on its own side rather than being led along a line.
      const bearing = Math.atan2(
        sheep.position!.y - second.y,
        sheep.position!.x - second.x,
      );

      expect(Math.abs(angleDifference(bearing, approach)) * 180 / Math.PI)
        .toBeLessThanOrEqual(90);
    },
  );
}

/**
 * A builder not carried is left on the line it walked in on, so it keeps the
 * ground it had already cleared rather than being pulled round to a corner. One
 * that is carried is moved a cell round, off that line.
 */
it(
  "leaves a builder on its line unless it is carried",
  { sheep: ["player-0"], gold: 4000 },
  function* ({ ecs }) {
    const site = { x: 40, y: 30 };
    const drift: Record<number, number> = {};

    for (const degrees of [0, 20, 45, 70, 90, 135, 180, 270]) {
      const angle = degrees * Math.PI / 180;
      const sheep = newUnit(
        "player-0",
        "sheep",
        site.x + Math.cos(angle) * 4,
        site.y + Math.sin(angle) * 4,
      );

      yield;

      yield* timeBuilds(sheep, "hut", [site]);

      const bearing = Math.atan2(
        sheep.position!.y - site.y,
        sheep.position!.x - site.x,
      );
      drift[degrees] = Math.abs(angleDifference(bearing, angle)) * 180 /
        Math.PI;

      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === "hut" || e === sheep) ecs.removeEntity(e);
      }

      yield;
    }

    // Away from a corner it is left exactly where it came in.
    for (const degrees of [0, 20, 90, 180, 270]) {
      expect(drift[degrees]).toBeLessThan(1);
    }

    // At one, carried off that line by a cell.
    for (const degrees of [45, 70, 135]) {
      expect(drift[degrees]).toBeGreaterThan(10);
    }
  },
);

/**
 * The turn is given more of the approach on the side it carries toward than
 * against, so that coming at a corner slightly the way it turns still counts
 * and coming at it slightly against does not.
 */
it(
  "gives the turn more room the way it carries than against it",
  { sheep: ["player-0"], gold: 4000 },
  function* ({ ecs }) {
    const site = { x: 40, y: 30 };
    const drift: Record<number, number> = {};

    // A corner lies at 45°; these sit the same distance either side of it.
    for (const degrees of [20, 70]) {
      const angle = degrees * Math.PI / 180;
      const sheep = newUnit(
        "player-0",
        "sheep",
        site.x + Math.cos(angle) * 4,
        site.y + Math.sin(angle) * 4,
      );

      yield;

      yield* timeBuilds(sheep, "hut", [site]);

      const bearing = Math.atan2(
        sheep.position!.y - site.y,
        sheep.position!.x - site.x,
      );
      drift[degrees] = Math.abs(angleDifference(bearing, angle)) * 180 /
        Math.PI;

      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === "hut" || e === sheep) ecs.removeEntity(e);
      }

      yield;
    }

    // Against the turn it is left on its line; with it, carried off.
    expect(drift[20]).toBeLessThan(1);
    expect(drift[70]).toBeGreaterThan(10);
  },
);
