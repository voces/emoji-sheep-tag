import "@/client-testing/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { PATHING_TYPES } from "@/shared/pathing/constants.ts";
import { app, Entity } from "../ecs.ts";
import "./pathing.ts";
import "./action.ts";
import { isStalled } from "./action.ts";

const FRAME = 1 / 60;

const START = { x: 40, y: 29 };
const END = { x: 40, y: 31 };

const walker = () =>
  app.addEntity({
    id: "walker",
    position: { ...START },
    radius: 0.25,
    pathing: PATHING_TYPES.WALKABLE,
    movementSpeed: 3,
    turnSpeed: 10,
    // Already pointing the way, so no delta goes on turning.
    facing: Math.PI / 2,
    order: { type: "walk", target: END, path: [END] },
  });

/** Whether the walker still holds a path it has not walked out. */
const walking = (e: Entity) =>
  !!e.order && "path" in e.order && !!e.order.path?.length;

/** How far the walker gets each frame, while it still has somewhere to be. */
const steps = (e: Entity) => {
  const distances: number[] = [];
  for (let frame = 0; frame < 120 && walking(e); frame++) {
    const before = { ...e.position! };
    app.update(FRAME);
    distances.push(
      Math.hypot(e.position!.x - before.x, e.position!.y - before.y),
    );
  }
  return distances;
};

describe("predicting a walker past what is in its way", () => {
  /**
   * A unit squeezing past an enemy that is body blocking it. The server has
   * both a tick ahead of where the client thinks they are and its own rules
   * about who may walk through whom, so the client cannot tell whether the
   * squeeze comes off — and standing still until the next update arrives is
   * what makes it step at 20 a second instead of every frame.
   */
  it("keeps moving every frame past another unit", () => {
    app.addEntity({
      id: "blocker",
      position: { x: 40, y: 30 },
      radius: 0.5,
      pathing: PATHING_TYPES.WALKABLE,
      movementSpeed: 3,
    });

    const e = walker();
    const distances = steps(e);

    // Straight through where the blocker stands, without a frame of standing
    // still on the way.
    expect(e.position!.y).toBeGreaterThan(30.5);
    expect(distances.filter((d) => d === 0).length).toBe(0);
    expect(isStalled(e)).toBe(false);
  });

  /**
   * A structure is the same on both sides and is not predicted, so walking into
   * one is not a disagreement that the next update settles — it is just wrong,
   * and it stays on screen.
   */
  it("holds against a structure rather than predicting into it", () => {
    app.addEntity({
      id: "structure",
      position: { x: 40, y: 30 },
      radius: 0.5,
      pathing: PATHING_TYPES.WALKABLE,
      tilemap: {
        top: -2,
        left: -2,
        width: 4,
        height: 4,
        map: new Array(16).fill(PATHING_TYPES.WALKABLE),
      },
    });

    const e = walker();
    steps(e);

    expect(e.position!.y).toBeLessThan(29.5);
    expect(isStalled(e)).toBe(true);
  });
});
