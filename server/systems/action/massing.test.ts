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
 * of a pair it lays first decides where it stands for the next row. Laying them
 * one way round is quicker than the other, which is the point: without the turn
 * it is set down in the hole between four and the choice means nothing.
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
      Math.min(leftFirst, rightFirst) * 0.1,
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
