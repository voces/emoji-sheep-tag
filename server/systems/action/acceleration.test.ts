import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderMove } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { computeUnitMovementSpeed } from "@/shared/api/unit.ts";

afterEach(cleanupTest);

const TICK = 0.05;

it(
  "starts from a standstill and is up to speed within a step",
  { sheep: ["player-0"] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 40, 30);

    yield;

    const full = computeUnitMovementSpeed(sheep);
    expect(sheep.speed ?? 0).toBe(0);

    orderMove(sheep, { x: 46, y: 30 });

    // The step it first covers ground on is short of a full one, having spent
    // part of it getting going; by the next it is at speed.
    let previous = { ...sheep.position! };
    let first = 0;
    for (let tick = 0; tick < 10 && !first; tick++) {
      yield;
      first = Math.hypot(
        sheep.position!.x - previous.x,
        sheep.position!.y - previous.y,
      );
      previous = { ...sheep.position! };
    }

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(full * TICK);

    // Settled on one heading it covers a whole step, so the ramp is paid once
    // on setting off rather than being a standing tax on moving.
    let settled = 0;
    for (let tick = 0; tick < 8; tick++) {
      yield;
      settled = Math.hypot(
        sheep.position!.x - previous.x,
        sheep.position!.y - previous.y,
      );
      previous = { ...sheep.position! };
    }

    expect(sheep.speed).toBeCloseTo(full);
    expect(settled).toBeCloseTo(full * TICK);
  },
);

it(
  "loses speed through a turn and has to pick it up again",
  { sheep: ["player-0"] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 40, 30);

    yield;

    // Up to speed along one heading...
    orderMove(sheep, { x: 46, y: 30 });
    for (let tick = 0; tick < 12; tick++) yield;

    const atSpeed = sheep.speed;
    expect(atSpeed).toBeCloseTo(computeUnitMovementSpeed(sheep));

    // ...then sent back the way it came.
    orderMove(sheep, { x: 34, y: 30 });

    let slowest = atSpeed!;
    for (let tick = 0; tick < 8; tick++) {
      yield;
      slowest = Math.min(slowest, sheep.speed ?? 0);
    }

    // Turning right around sheds it entirely; a unit comes out of a corner
    // having to get going, which is what makes a hard turn cost something.
    expect(slowest).toBe(0);
  },
);

/**
 * How sharp the corner is decides how much speed it costs. Before, any turn
 * past a hair over ten degrees shed the lot, so a slight correction cost as
 * much as swinging right around — and the angle it happened at fell out of the
 * unit's turn speed rather than being chosen.
 */
it(
  "gives up more ground the sharper the corner",
  { sheep: ["player-0"] },
  function* ({ ecs }) {
    const covered: number[] = [];

    for (const degrees of [10, 30, 55]) {
      const sheep = newUnit("player-0", "sheep", 40, 30);

      yield;

      // Up to speed heading due east.
      orderMove(sheep, { x: 52, y: 30 });
      for (let tick = 0; tick < 14; tick++) yield;
      expect(sheep.speed).toBeCloseTo(computeUnitMovementSpeed(sheep));

      // Then sent off at an angle from where it stands.
      const angle = degrees * Math.PI / 180;
      const from = { ...sheep.position! };
      orderMove(sheep, {
        x: from.x + Math.cos(angle) * 8,
        y: from.y + Math.sin(angle) * 8,
      });

      yield;

      covered.push(
        Math.hypot(sheep.position!.x - from.x, sheep.position!.y - from.y),
      );

      ecs.removeEntity(sheep);

      yield;
    }

    // Ground given up rises with the angle, rather than every corner past a
    // dozen degrees costing the same.
    expect(covered[0]).toBeGreaterThan(covered[1]);
    expect(covered[1]).toBeGreaterThan(covered[2]);
    // And even the slightest of them gives up something, where before anything
    // under the cliff was taken at full speed for free.
    expect(covered[0]).toBeLessThan(3 * TICK * 0.999);
  },
);
