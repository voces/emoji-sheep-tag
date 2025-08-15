import { afterEach } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Entity } from "@/shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { prefabs } from "@/shared/data.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

it(
  "integration: sheep walking around a corner",
  { wolves: [], sheep: [] },
  function* ({ ecs }) {
    const sheep = ecs.addEntity<Entity>({
      ...prefabs.sheep,
      id: "sheep-0",
      radius: 0.25,
      position: { x: 0.25, y: 0.25 },
      pathing: 1,
    });
    ecs.addEntity({
      id: "hut-0",
      radius: 0.5,
      tilemap: {
        map: Array(16).fill(3),
        top: -2,
        left: -2,
        width: 4,
        height: 4,
      },
      position: { x: 1.25, y: 1.25 },
      pathing: 1,
    });

    expect(sheep.position).toEqual({ x: 0.25, y: 0.25 });

    orderMove(sheep, { x: 2.25, y: 2 });
    yield;

    expect(sheep.position).toEqual({ x: 0.25, y: 0.25 });
    expect(sheep.order).toEqual({
      type: "walk",
      target: { x: 2.25, y: 2 },
      path: [{ x: 2.25, y: 2 }],
    });

    // Keep yielding until the sheep reaches its destination
    while (
      !sheep.position || sheep.position.x !== 2.25 || sheep.position.y !== 2
    ) yield;

    expect(sheep.position).toEqual({ x: 2.25, y: 2 });
  },
);
