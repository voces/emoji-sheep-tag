import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";
import { newUnit } from "../api/unit.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";

afterEach(cleanupTest);

const speedAura = (entity: Entity) =>
  entity.buffs?.find((b) => b.auraBuff === "totemMovementAura");

it("applies an aura to nearby allies and lingers after they leave", {
  sheep: ["sheep-player"],
}, function* ({ ecs, clients }) {
  const owner = clients.get("sheep-player")!.id;
  newUnit(owner, "totem", 20, 20);
  const sheep = newUnit(owner, "sheep", 22, 20);
  yield;

  expect(speedAura(sheep)).toBeDefined();
  expect(speedAura(sheep)!.remainingDuration).toBeUndefined();

  ecs.batch(() => sheep.position = { x: 40, y: 40 });
  yield;
  expect(speedAura(sheep)!.remainingDuration).toBeCloseTo(2, 0);

  ecs.batch(() => sheep.position = { x: 22, y: 20 });
  yield;
  expect(speedAura(sheep)!.remainingDuration).toBeUndefined();

  ecs.batch(() => sheep.position = { x: 40, y: 40 });
  yield* yieldFor(2.5);
  expect(speedAura(sheep)).toBeUndefined();
});

it("lingers an aura when its source is removed", {
  sheep: ["sheep-player"],
}, function* ({ ecs, clients }) {
  const owner = clients.get("sheep-player")!.id;
  const totem = newUnit(owner, "totem", 20, 20);
  const sheep = newUnit(owner, "sheep", 22, 20);
  yield;
  expect(speedAura(sheep)!.remainingDuration).toBeUndefined();

  ecs.batch(() => removeEntity(totem));
  yield;
  expect(speedAura(sheep)!.remainingDuration).toBeCloseTo(2, 0);

  yield* yieldFor(2.5);
  expect(speedAura(sheep)).toBeUndefined();
});

it("applies item auras from units without direct buffs", {
  sheep: ["sheep-player"],
}, function* ({ ecs, clients }) {
  const owner = clients.get("sheep-player")!.id;
  const carrier = newUnit(owner, "sheep", 20, 20);
  const sheep = newUnit(owner, "sheep", 22, 20);
  ecs.batch(() =>
    carrier.inventory = [{
      id: "banner",
      name: "Banner",
      gold: 0,
      binding: [],
      buffs: [{
        radius: 7,
        auraBuff: "totemMovementAura",
        targetsAllowed: [["unit", "ally"]],
      }],
    }]
  );
  yield;

  expect(carrier.buffs).toBeFalsy();
  expect(speedAura(sheep)).toBeDefined();
});
