import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { pathable } from "../pathing.ts";

afterEach(cleanupTest);

it("stop distance", { sheep: ["player-0"], gold: 4000 }, function* ({ ecs }) {
  const site = { x: 40, y: 30 };

  for (const away of [3, 3.03, 3.07, 3.11, 3.17, 3.23]) {
    const sheep = newUnit("player-0", "sheep", site.x + away, site.y);

    yield;

    orderBuild(sheep, "hut", site.x, site.y);

    // Watch the last position it held while the order was still live: that is
    // where it stood when the hut went up.
    let atBuild = { ...sheep.position! };
    for (let tick = 0; tick < 600 && sheep.order; tick++) {
      atBuild = { ...sheep.position! };
      yield;
    }

    const dx = Math.abs(atBuild.x - site.x);
    const hut = Array.from(ecs.entities).find((e) => e.prefab === "hut")!;
    const clear = pathable(sheep, atBuild);

    console.log(
      `start ${away}: stopped ${dx.toFixed(3)} out; clear of hut = ${clear}`,
    );

    for (const e of Array.from(ecs.entities)) {
      if (e.prefab === "hut" || e === sheep) ecs.removeEntity(e);
    }
    expect(hut).toBeTruthy();

    yield;
  }
});
