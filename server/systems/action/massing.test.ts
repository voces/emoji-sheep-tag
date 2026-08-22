import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";

afterEach(cleanupTest);

/** Gap between the two columns, and between rows, of a hut lattice. */
const PITCH = 1;

const DIRECTIONS: [string, number, number][] = [
  ["down", 0, -1],
  ["up", 0, 1],
  ["left", -1, 0],
  ["right", 1, 0],
];

/**
 * Massing lays a lattice rather than a line, so no two structures are close
 * enough to continue one another and every placement falls back on the way the
 * builder walked in. Doing the same thing twice has to put it in the same
 * place, whatever that place is.
 */
for (const [label, dx, dy] of DIRECTIONS) {
  it(
    `places the builder alike on every row massing ${label}`,
    { sheep: ["player-0"], gold: 4000 },
    function* () {
      const origin = { x: 40, y: 30 };

      // Rows run along the direction of travel; the pair sits across it.
      const at = (row: number, second: boolean) => {
        const along = { x: dx * PITCH * row, y: dy * PITCH * row };
        const across = second ? { x: -dy * PITCH, y: dx * PITCH } : {
          x: 0,
          y: 0,
        };
        return {
          x: origin.x + along.x + across.x,
          y: origin.y + along.y + across.y,
        };
      };

      const sheep = newUnit(
        "player-0",
        "sheep",
        origin.x - dx * 3,
        origin.y - dy * 3,
      );

      yield;

      const placements: string[] = [];

      for (let row = 0; row < 7; row++) {
        for (const second of [false, true]) {
          const site = at(row, second);
          orderBuild(sheep, "hut", site.x, site.y);
          for (let tick = 0; tick < 600 && sheep.order; tick++) yield;

          // Only the first of each pair: that is the one being compared.
          if (!second) {
            placements.push(
              `${(sheep.position!.x - site.x).toFixed(2)},${
                (sheep.position!.y - site.y).toFixed(2)
              }`,
            );
          }
        }
      }

      // Every row is the same build from the same relative position, so every
      // row has to leave the builder in the same relative spot.
      // Each row is entered from where the row before left the builder, so the
      // pattern takes a few rows to settle. It settles into a repeat rather
      // than a single spot: which of a pair is laid first alternates what the
      // next row is entered from, so rows match the row two back.
      const settled = placements.slice(3);
      for (let i = 2; i < settled.length; i++) {
        expect(settled[i]).toBe(settled[i - 2]);
      }
    },
  );
}

/**
 * The same build walked the same way has to put the builder in the same place.
 * Where a tick happens to land along the approach shifts where it stands when
 * the structure goes up, by up to a step of movement, and that must not carry
 * through to where it ends up.
 */
for (const prefab of ["hut", "cottage", "house"]) {
  it(
    `places the builder alike however the ticks fall building a ${prefab}`,
    { sheep: ["player-0"], gold: 4000 },
    function* ({ ecs }) {
      const site = { x: 40, y: 30 };
      const landings = new Set<string>();

      for (const degrees of [0, 12, 47, 91, 133, 178, 224, 266, 311, 350]) {
        const angle = degrees * Math.PI / 180;

        // Jitter the distance walked in, which is what a tick boundary does.
        for (const away of [3, 3.03, 3.07, 3.11, 3.17, 3.23]) {
          const sheep = newUnit(
            "player-0",
            "sheep",
            site.x + Math.cos(angle) * away,
            site.y + Math.sin(angle) * away,
          );

          yield;

          orderBuild(sheep, prefab, site.x, site.y);
          for (let tick = 0; tick < 600 && sheep.order; tick++) yield;

          // Normalised, so that a negative zero does not read as a
          // different spot from a positive one.
          const at = (v: number) =>
            (Math.round(v * 1000) / 1000 + 0).toFixed(3);
          landings.add(
            `${degrees}: ${at(sheep.position!.x - site.x)},${
              at(sheep.position!.y - site.y)
            }`,
          );

          for (const e of Array.from(ecs.entities)) {
            if (e.prefab === prefab || e === sheep) ecs.removeEntity(e);
          }

          yield;
        }
      }

      console.log("  " + prefab + ": " + landings.size + " landings");
      for (const l of landings) console.log("    " + l);
      expect(landings.size).toBe(10);
    },
  );
}

/**
 * A builder is turned a consistent way round each structure it lays, so which
 * of a pair it lays first decides where it stands for the next row, and one way
 * round is quicker than the other. Without the turn it is set down in the hole
 * between four and the choice means nothing. The margin is small — the builder
 * is held in against its own work either way, so neither order walks far.
 */
it(
  "makes it matter which of a pair is laid first",
  { sheep: ["player-0"], gold: 4000 },
  function* ({ ecs }) {
    const origin = { x: 40, y: 30 };

    const mass = function* (leftFirst: boolean) {
      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === "hut") ecs.removeEntity(e);
      }

      const sheep = newUnit("player-0", "sheep", origin.x, origin.y + 3);

      yield;

      let ticks = 0;
      for (let row = 0; row < 7; row++) {
        const y = origin.y - row;
        const pair = leftFirst
          ? [origin.x, origin.x + 1]
          : [origin.x + 1, origin.x];

        for (const x of pair) {
          orderBuild(sheep, "hut", x, y);
          while (sheep.order && ticks < 900) {
            ticks++;
            yield;
          }
        }
      }

      ecs.removeEntity(sheep);

      yield;

      return ticks;
    };

    const leftFirst = yield* mass(true);
    const rightFirst = yield* mass(false);

    expect(Math.abs(leftFirst - rightFirst)).toBeGreaterThan(
      Math.min(leftFirst, rightFirst) * 0.05,
    );
  },
);

/**
 * Having been carried round one structure, a builder meets the next a little
 * short of its corner rather than square at it. That is not coming at a corner,
 * and must not be carried again on the strength of the last carry.
 */
it(
  "does not carry a builder again off the last carry",
  { sheep: ["player-0"], gold: 40000 },
  function* () {
    const pitch = 1.5;
    const left = 40;
    const right = left + pitch;
    const bottom = 30;
    const top = bottom + pitch;

    // The two above already up; come down the hole between them.
    newUnit("player-0", "hut", left, top);
    newUnit("player-0", "hut", right, top);

    const sheep = newUnit("player-0", "sheep", left + pitch / 2, top + 1.5);

    yield;

    const build = function* (x: number) {
      orderBuild(sheep, "hut", x, bottom);
      let at = { ...sheep.position! };
      for (let tick = 0; tick < 300 && sheep.order; tick++) {
        at = { ...sheep.position! };
        yield;
      }
      return Math.atan2(at.y - bottom, at.x - x) * 180 / Math.PI;
    };

    // Square at the corner, so carried off the line it came in on.
    const first = yield* build(right);
    expect(Math.abs(first - 135)).toBeLessThan(5);
    const firstBearing = Math.atan2(
      sheep.position!.y - bottom,
      sheep.position!.x - right,
    ) * 180 / Math.PI;
    expect(Math.abs(firstBearing - first)).toBeGreaterThan(10);

    // Short of the corner by more than a nudge, so left on its line — keeping
    // the ground it had already cleared rather than being pulled to the corner.
    const second = yield* build(left);
    expect(second).toBeLessThan(45 - 10);
    const secondBearing = Math.atan2(
      sheep.position!.y - bottom,
      sheep.position!.x - left,
    ) * 180 / Math.PI;
    expect(Math.abs(secondBearing - second)).toBeLessThan(1);
  },
);

/**
 * Filling the last corner of a close block, the spot a builder is owed is
 * inside a neighbour. It has to be set down against what it just built, not
 * carried round the far side of the neighbour that took its spot.
 */
for (const pitch of [1, 1.25]) {
  it(
    `sets a builder beside the structure it just closed a block with, pitch ${pitch}`,
    { sheep: ["player-0"], gold: 40000 },
    function* () {
      const left = 40;
      const bottom = 30;
      const right = left + pitch;
      const top = bottom + pitch;

      // Three of four up; the builder fills the last from just above it.
      newUnit("player-0", "hut", left, top);
      newUnit("player-0", "hut", right, top);
      newUnit("player-0", "hut", right, bottom);

      const sheep = newUnit("player-0", "sheep", left, bottom + 0.75);

      yield;

      orderBuild(sheep, "hut", left, bottom);
      for (let tick = 0; tick < 300 && sheep.order; tick++) yield;

      // Against the hut it laid, rather than past the one above it.
      const outX = sheep.position!.x - left;
      const outY = sheep.position!.y - bottom;

      expect(Math.max(Math.abs(outX), Math.abs(outY))).toBeCloseTo(0.75);
      expect(Math.hypot(outX, outY)).toBeLessThan(1.1);
    },
  );
}

/**
 * A cross of huts divides the ground into four holes a house fits snugly in,
 * meeting at the middle. Filling one from its inside corner, the spot the
 * builder is owed is inside the cross, and the turn it was carried round the
 * house decides which way it comes back out — so it is passed to the next hole
 * round, the same way about from whichever it started in.
 */
it(
  "passes a builder the same way round a cross of holes",
  { sheep: ["player-0"], gold: 40000 },
  function* ({ ecs }) {
    const middle = { x: 40, y: 30 };

    // A hole in each quarter, and the inside corner of each.
    const QUARTERS: [number, number][] = [[-1, -1], [-1, 1], [1, 1], [1, -1]];

    for (const [qx, qy] of QUARTERS) {
      for (let i = -2; i <= 2; i++) {
        newUnit("player-0", "hut", middle.x + i, middle.y);
        if (i !== 0) newUnit("player-0", "hut", middle.x, middle.y + i);
      }

      const site = { x: middle.x + qx * 1.5, y: middle.y + qy * 1.5 };
      const sheep = newUnit(
        "player-0",
        "sheep",
        middle.x + qx * 0.75,
        middle.y + qy * 0.75,
      );

      yield;

      orderBuild(sheep, "house", site.x, site.y);
      for (let tick = 0; tick < 400 && sheep.order; tick++) yield;

      // The next quarter clockwise, at its inside corner.
      expect(sheep.position!.x).toBeCloseTo(middle.x + qy * 0.75);
      expect(sheep.position!.y).toBeCloseTo(middle.y - qx * 0.75);

      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === "hut" || e.prefab === "house" || e === sheep) {
          ecs.removeEntity(e);
        }
      }

      yield;
    }
  },
);

/**
 * Standing in the middle of a two-by-two and filling the last of it, every way
 * out is over a neighbour. The builder belongs against the structure it just
 * laid, not carried across one of the others and left outside everything it has
 * built.
 */
it(
  "keeps a builder in when it fills a block from the middle",
  { sheep: ["player-0"], gold: 40000 },
  function* ({ ecs }) {
    const middle = { x: 40, y: 30 };
    const CORNERS: [number, number][] = [[-1, -1], [-1, 1], [1, 1], [1, -1]];

    const landings: { x: number; y: number }[] = [];

    for (const [qx, qy] of CORNERS) {
      const site = { x: middle.x + qx * 0.5, y: middle.y + qy * 0.5 };

      for (const [ox, oy] of CORNERS) {
        if (ox === qx && oy === qy) continue;
        newUnit("player-0", "hut", middle.x + ox * 0.5, middle.y + oy * 0.5);
      }

      const sheep = newUnit(
        "player-0",
        "sheep",
        middle.x + qx * 0.25,
        middle.y + qy * 0.25,
      );

      yield;

      orderBuild(sheep, "hut", site.x, site.y);
      for (let tick = 0; tick < 400 && sheep.order; tick++) yield;

      const out = {
        x: sheep.position!.x - site.x,
        y: sheep.position!.y - site.y,
      };

      // Against the hut it laid, rather than past one of the others.
      expect(Math.max(Math.abs(out.x), Math.abs(out.y))).toBeCloseTo(0.75);
      expect(Math.hypot(out.x, out.y)).toBeLessThan(1.1);
      landings.push(out);

      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === "hut" || e === sheep) ecs.removeEntity(e);
      }

      yield;
    }

    // The same corner of the block, turned four ways, so the same spot turned
    // four ways: the builder is carried the same way about wherever it stands.
    for (let i = 1; i < landings.length; i++) {
      expect(landings[i].x).toBeCloseTo(landings[i - 1].y);
      expect(landings[i].y).toBeCloseTo(-landings[i - 1].x);
    }
  },
);
