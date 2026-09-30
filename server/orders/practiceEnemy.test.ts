import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Entity } from "@/shared/types.ts";
import { practiceModeActions } from "@/shared/data.ts";
import { getOrder } from "./index.ts";

const giveToEnemy = (unit: Entity) =>
  getOrder("giveToEnemy").onIssue(unit, undefined, false);
const reclaimFromEnemy = (unit: Entity) =>
  getOrder("reclaimFromEnemy").onIssue(unit, undefined, false);

const practiceWolf = (): Entity => ({
  id: "wolf",
  owner: "player-1",
  trueOwner: "player-1",
  actions: [practiceModeActions.giveToEnemy],
  order: { type: "attack", targetId: "sheep" },
});

describe("practice enemy control", () => {
  it("gives a unit to the practice enemy and swaps in reclaim", () => {
    const wolf = practiceWolf();

    expect(giveToEnemy(wolf)).toBe("immediate");
    expect(wolf.owner).toBe("practice-enemy");
    expect(wolf.actions).toEqual([practiceModeActions.reclaimFromEnemy]);
    expect(wolf.order).toEqual({ type: "attack", targetId: "sheep" });
  });

  it("reclaims a unit, swaps in give, and drops its attack order", () => {
    const wolf = practiceWolf();
    giveToEnemy(wolf);

    expect(reclaimFromEnemy(wolf)).toBe("immediate");
    expect(wolf.owner).toBe("player-1");
    expect(wolf.actions).toEqual([practiceModeActions.giveToEnemy]);
    expect(wolf.order).toBeNull();
  });

  it("fails when the unit is already on the requested side", () => {
    const wolf = practiceWolf();
    expect(reclaimFromEnemy(wolf)).toBe("failed");
    giveToEnemy(wolf);
    expect(giveToEnemy(wolf)).toBe("failed");
    expect(wolf.owner).toBe("practice-enemy");
  });

  it("fails outside practice mode", () => {
    const wolf: Entity = { id: "wolf", owner: "player-1" };
    expect(giveToEnemy(wolf)).toBe("failed");
    expect(reclaimFromEnemy({ ...wolf, owner: "practice-enemy" })).toBe(
      "failed",
    );
  });
});
