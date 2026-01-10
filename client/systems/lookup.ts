import { map } from "../ecs.ts";

// Wrapper function matching the server's lookup interface
// Uses the existing `map` from ecs.ts which tracks all entities by id
export const lookup = (entityId: string | null | undefined) => {
  if (!entityId) return;
  return map[entityId];
};
