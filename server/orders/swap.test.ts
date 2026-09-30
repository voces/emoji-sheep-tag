import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit } from "../api/unit.ts";
import { advanceCast } from "../systems/action/advanceCast.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { getOrder } from "./index.ts";

afterEach(cleanupTest);

it("swaps positions and facing with the caster's mirror", {
  wolves: ["test-client"],
}, function* () {
  const wolf = newUnit("test-client", "wolf", 5, 5);
  wolf.mana = 100;
  wolf.facing = 0;
  const mirror = newUnit("test-client", "wolf", 10, 5, {
    isMirror: true,
    facing: Math.PI,
  });
  yield;

  expect(getOrder("swap").canExecute?.(wolf, undefined)).toBe(true);
  getOrder("swap").onIssue(wolf, undefined, false);
  advanceCast(wolf, 0.1);
  yield;

  expect(wolf.buffs?.map((b) => b.name)).toEqual(["Swapping"]);
  expect(mirror.buffs?.map((b) => b.name)).toEqual(["Swapping"]);

  advanceCast(wolf, 1.4);
  yield;

  expect(wolf.position).toEqual({ x: 10, y: 5 });
  expect(mirror.position).toEqual({ x: 5, y: 5 });
  expect(wolf.facing).toBe(Math.PI);
  expect(mirror.facing).toBe(0);
});

it("cannot swap without a mirror", {
  wolves: ["test-client"],
}, function* () {
  const wolf = newUnit("test-client", "wolf", 5, 5);
  newUnit("other-client", "wolf", 10, 5, { isMirror: true });
  yield;

  expect(getOrder("swap").canExecute?.(wolf, undefined)).toBe(false);
});
