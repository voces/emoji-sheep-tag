import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";

afterEach(cleanupTest);

const STRUCTURES = [
  ["shack", 0.5],
  ["hut", 1],
  ["cabin", 1],
  ["cottage", 1.5],
  ["house", 2],
] as const;

const TICK = 0.05;

for (const [prefab, width] of STRUCTURES) {
  it(`rate ${prefab}`, { sheep: ["player-0"], gold: 4000 }, function* () {
    const first = { x: 30, y: 30 };
    const sheep = newUnit("player-0", "sheep", first.x - width, first.y);

    yield;

    const build = function* (n: number) {
      let ticks = 0;
      orderBuild(sheep, prefab, first.x + width * n, first.y);
      while (sheep.order && ticks < 900) {
        ticks++;
        yield;
      }
      return ticks;
    };

    // Lay one first so a wide exists; only what follows is steady state.
    yield* build(0);

    const from = { ...sheep.position! };
    let ticks = 0;
    const laid = 6;

    for (let n = 1; n <= laid; n++) ticks += yield* build(n);

    const to = sheep.position!;
    const travelled = Math.hypot(to.x - from.x, to.y - from.y);

    console.log(
      `${prefab.padEnd(8)} width ${width}: ${laid} laid in ${ticks} ticks; ` +
        `wall ${(width * laid).toFixed(2)} (${
          (width * laid / (ticks * TICK)).toFixed(2)
        } u/s), ` +
        `sheep moved ${travelled.toFixed(2)} (${
          (travelled / (ticks * TICK)).toFixed(2)
        } u/s)`,
    );
    expect(ticks).toBeLessThan(900);
  });
}
