import { Player } from "@/shared/api/player.ts";
import type { Entity } from "../ecs.ts";

export const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "player-0",
  isPlayer: true,
  name: "Test Player",
  playerColor: "red",
  sheepCount: 0,
  gold: 200,
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
