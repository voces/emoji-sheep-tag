import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderBuild, orderMove } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";

afterEach(cleanupTest);

const STEP = 0.5;

/** Footprint width, and how far out a sheep is set when displaced by one. */
const STRUCTURES = [
  ["cottage", 1.5, 1],
  ["house", 2, 1.25],
] as const;

/**
 * The eight slides. A wide runs along one axis and steps one square across it
 * each structure, always towards the side the builder stands on — stepping away
 * from the builder is not a slide. So each is a direction to run and a side to
 * run it on, and the step follows from the pair.
 */
const SLIDES: [string, number, number][] = [
  ["ENe", 1, 1],
  ["ESe", 1, -1],
  ["WNw", -1, 1],
  ["WSw", -1, -1],
  ["NNe", 1, 1],
  ["NNw", 1, -1],
  ["SSe", -1, 1],
  ["SSw", -1, -1],
];

for (const [prefab, WIDTH, CLEARANCE] of STRUCTURES) {
  for (const [label, along, side] of SLIDES) {
    const horizontal = label[0] === "E" || label[0] === "W";

    it(
      `slides a ${label} ${prefab} wide faster than walking it`,
      { sheep: ["player-0"], gold: 4000 },
      function* ({ ecs }) {
        // Cottages sit on the half grid, offset a quarter; houses on the half.
        const first = prefab === "cottage"
          ? { x: 40.25, y: 30.25 }
          : { x: 40, y: 30 };

        // Along the wide by a full cottage, across it by one square towards the
        // builder, which stands off the side it is stepping towards.
        const step = (n: number) =>
          horizontal
            ? { x: first.x + along * WIDTH * n, y: first.y + side * STEP * n }
            : { x: first.x + side * STEP * n, y: first.y + along * WIDTH * n };

        const start = horizontal
          ? { x: first.x, y: first.y + side * CLEARANCE }
          : { x: first.x + side * CLEARANCE, y: first.y };

        newUnit("player-0", prefab, first.x, first.y);
        const slider = newUnit("player-0", "sheep", start.x, start.y);

        yield;

        let sliding = 0;
        for (let n = 1; n <= 4; n++) {
          const site = step(n);
          orderBuild(slider, prefab, site.x, site.y);
          while (slider.order && sliding < 900) {
            sliding++;
            yield;
          }
        }

        const landed = { ...slider.position! };

        for (const e of Array.from(ecs.entities)) {
          if (e.prefab === prefab || e === slider) ecs.removeEntity(e);
        }

        yield;

        // The same journey on foot, over ground now clear of what it built.
        const walker = newUnit("player-0", "sheep", start.x, start.y);

        yield;

        orderMove(walker, landed);

        let walking = 0;
        while (walker.order && walking < 900) {
          walking++;
          yield;
        }

        // It follows the wide across exactly as the wide steps, and covers at
        // least its length along — how much further depends on how far ahead a
        // builder is set, which is a tuning knob rather than a property.
        const far = step(4);
        const alongOf = (p: { x: number; y: number }) => horizontal ? p.x : p.y;
        const acrossOf = (p: { x: number; y: number }) =>
          horizontal ? p.y : p.x;

        expect(acrossOf(landed) - acrossOf(start)).toBeCloseTo(
          acrossOf(far) - acrossOf(first),
        );
        expect(Math.sign(alongOf(landed) - alongOf(start))).toBe(along);
        expect(Math.abs(alongOf(landed) - alongOf(start)))
          .toBeGreaterThanOrEqual(
            Math.abs(alongOf(far) - alongOf(first)) - 0.01,
          );

        // The point of a slide: laying the wide gets the builder there quicker
        // than walking the same ground would have.
        expect(sliding).toBeLessThan(walking);
      },
    );
  }
}

/**
 * Only a cottage or a house is a wide. Anything smaller sits so close to the
 * line it is laid along that carrying the builder would send it faster than a
 * house does, which is backwards — so laying a line of them is walking, plus
 * the time spent building.
 */
for (
  const [prefab, width, clearance] of [
    ["shack", 0.5, 0.5],
    ["hut", 1, 0.75],
    ["cabin", 1, 0.75],
  ] as const
) {
  it(
    `does not slide along a line of ${prefab}`,
    { sheep: ["player-0"], gold: 40000 },
    function* ({ ecs }) {
      const first = { x: 40, y: 30 };
      const start = { x: first.x, y: first.y + clearance };

      newUnit("player-0", prefab, first.x, first.y);
      const slider = newUnit("player-0", "sheep", start.x, start.y);

      yield;

      let laying = 0;
      for (let n = 1; n <= 4; n++) {
        orderBuild(slider, prefab, first.x + width * n, first.y + STEP * n);
        while (slider.order && laying < 900) {
          laying++;
          yield;
        }
      }

      const landed = { ...slider.position! };
      for (const e of Array.from(ecs.entities)) {
        if (e.prefab === prefab || e === slider) ecs.removeEntity(e);
      }

      yield;

      const walker = newUnit("player-0", "sheep", start.x, start.y);

      yield;

      orderMove(walker, landed);

      let walking = 0;
      while (walker.order && walking < 900) {
        walking++;
        yield;
      }

      expect(laying).toBeGreaterThan(walking);
    },
  );
}
