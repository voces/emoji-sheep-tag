import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { newUnit } from "../api/unit.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "should not autocast a buff on a target already being cast on by another unit",
  function* () {
    const sheep = newUnit("sheep-player", "sheep", 5, 5);
    const crystal1 = newUnit("sheep-player", "crystal", 5, 6);
    const crystal2 = newUnit("sheep-player", "crystal", 5, 4);
    crystal1.progress = undefined;
    crystal2.progress = undefined;
    crystal1.autocast = ["crystalSpeed"];
    crystal2.autocast = ["crystalSpeed"];

    yield* yieldFor(() => {
      expect(crystal1.order || crystal2.order).toBeTruthy();
    });

    const caster1 = crystal1.order ? crystal1 : crystal2;
    const caster2 = crystal1.order ? crystal2 : crystal1;

    expect(caster1.order).toMatchObject({
      type: "cast",
      orderId: "crystalSpeed",
      targetId: sheep.id,
    });
    expect(caster2.order).toBeFalsy();
  },
);

it(
  "two crystals with two autocast actions should distribute actions",
  function* () {
    const sheep = newUnit("sheep-player", "sheep", 5, 5);
    const crystal1 = newUnit("sheep-player", "crystal", 5, 6);
    const crystal2 = newUnit("sheep-player", "crystal", 5, 4);
    crystal1.progress = undefined;
    crystal2.progress = undefined;
    crystal1.mana = 200;
    crystal1.maxMana = 200;
    crystal2.mana = 200;
    crystal2.maxMana = 200;
    crystal1.autocast = ["crystalSpeed", "crystalInvisibility"];
    crystal2.autocast = ["crystalSpeed", "crystalInvisibility"];

    yield* yieldFor(() => {
      expect(crystal1.order).toBeTruthy();
      expect(crystal2.order).toBeTruthy();
    });

    expect(crystal1.order).toMatchObject({
      type: "cast",
      targetId: sheep.id,
    });
    expect(crystal2.order).toMatchObject({
      type: "cast",
      targetId: sheep.id,
    });

    const orderIds = [
      crystal1.order!.type === "cast" ? crystal1.order!.orderId : undefined,
      crystal2.order!.type === "cast" ? crystal2.order!.orderId : undefined,
    ].sort();

    expect(orderIds).toEqual(["crystalInvisibility", "crystalSpeed"]);
  },
);
