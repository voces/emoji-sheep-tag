import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Buff, Entity } from "@/shared/types.ts";
import { newEcs } from "../ecs.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newLobby } from "../lobby.ts";
import "./buffs.ts"; // Import to register the system

afterEach(() => {
  try {
    lobbyContext.context.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
});

const setup = () => {
  const ecs = newEcs();
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    addEventListener: () => {},
  });
  clientContext.context = client;
  const lobby = newLobby();
  lobby.round = {
    ecs,
    sheep: new Set(),
    wolves: new Set(),
    start: Date.now(),
    clearInterval: () => {},
  };
  lobbyContext.context = lobby;
  return { ecs, client, lobby };
};

describe("buffs system", () => {
  it("should reduce buff duration over time", () => {
    const { ecs } = setup();

    const buff: Buff = {
      remainingDuration: 10,
      attackSpeedMultiplier: 1.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(2); // Advance 2 seconds

    expect(entity.buffs).toBeDefined();
    expect(entity.buffs![0].remainingDuration).toBe(8);
  });

  it("should remove expired buffs", () => {
    const { ecs } = setup();

    const buff: Buff = {
      remainingDuration: 2,
      movementSpeedBonus: 0.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(3); // Advance 3 seconds (buff expires at 2)

    expect(entity.buffs).toBeFalsy();
  });

  it("should handle multiple buffs with different durations", () => {
    const { ecs } = setup();

    const buff1: Buff = {
      remainingDuration: 5,
      attackSpeedMultiplier: 1.2,
    };

    const buff2: Buff = {
      remainingDuration: 10,
      movementSpeedBonus: 0.3,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff1, buff2],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(6); // Advance 6 seconds

    // buff1 should be expired, buff2 should remain
    expect(entity.buffs).toBeDefined();
    expect(entity.buffs!.length).toBe(1);
    expect(entity.buffs![0].remainingDuration).toBe(4);
  });

  it("should preserve buffs immutability", () => {
    const { ecs } = setup();

    const originalBuff: Buff = {
      remainingDuration: 10,
      attackSpeedMultiplier: 1.5,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [originalBuff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(2);

    // Original buff should be unchanged
    expect(originalBuff.remainingDuration).toBe(10);
    // Entity's buff should be updated
    expect(entity.buffs![0].remainingDuration).toBe(8);
    // Should be a different object
    expect(entity.buffs![0]).not.toBe(originalBuff);
  });

  it("should delete buffs property when all buffs expire", () => {
    const { ecs } = setup();

    const buff1: Buff = {
      remainingDuration: 2,
      attackSpeedMultiplier: 1.1,
    };

    const buff2: Buff = {
      remainingDuration: 3,
      movementSpeedBonus: 0.2,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff1, buff2],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(4); // All buffs expire

    expect(entity.buffs).toBeFalsy();
  });

  it("should handle fractional time updates", () => {
    const { ecs } = setup();

    const buff: Buff = {
      remainingDuration: 5.5,
      attackSpeedMultiplier: 1.15,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(0.3);
    ecs.update(0.2);
    ecs.update(0.5);

    expect(entity.buffs![0].remainingDuration).toBeCloseTo(4.5);
  });

  it("should handle movement speed multiplier buffs", () => {
    const { ecs } = setup();

    const buff: Buff = {
      remainingDuration: 10,
      movementSpeedMultiplier: 1.15,
    };

    const entityInput: Entity = {
      id: "test-entity",
      buffs: [buff],
    };

    const entity = ecs.addEntity(entityInput);
    ecs.update(3); // Advance 3 seconds

    expect(entity.buffs).toBeDefined();
    expect(entity.buffs![0].remainingDuration).toBe(7);
    expect(entity.buffs![0].movementSpeedMultiplier).toBe(1.15);
  });
});
