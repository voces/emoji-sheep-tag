import type { Player } from "@/vars/players.ts";
import type { Entity } from "../ecs.ts";

export const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "player-0",
  name: "Test Player",
  color: "red",
  local: true,
  sheepCount: 0,
  entity: { id: "player-entity", gold: 200, mana: 100, maxMana: 100 },
  ...overrides,
});

export const createTestSelection = (
  overrides: Partial<Entity> = {},
): Entity => ({
  id: "wolf-0",
  owner: "player-0",
  prefab: "wolf",
  actions: [],
  ...overrides,
});
