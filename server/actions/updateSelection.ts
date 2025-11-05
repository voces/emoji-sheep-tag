import { z } from "zod";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { getEntitiesWithSelection } from "../systems/selectedBy.ts";

export const zUpdateSelection = z.object({
  type: z.literal("updateSelection"),
  entityIds: z.array(z.string()),
});

export const updateSelection = (
  client: Client,
  { entityIds }: z.TypeOf<typeof zUpdateSelection>,
) => {
  if (!client.lobby?.round) return;

  const player = lookup(client.id);
  if (!player) return;

  // First, remove this player from selectedBy of all entities that have selections
  const entitiesWithSelection = getEntitiesWithSelection();
  if (entitiesWithSelection) {
    for (const entity of entitiesWithSelection) {
      if (!entity.selectedBy?.includes(client.id)) continue;
      const filtered = entity.selectedBy.filter((id) => id !== client.id);
      if (filtered.length === 0) delete entity.selectedBy;
      else entity.selectedBy = filtered;
    }
  }

  // Then, add this player to selectedBy of newly selected entities
  for (const entityId of entityIds) {
    const entity = lookup(entityId);
    if (!entity) continue;

    entity.selectedBy = [...(entity.selectedBy ?? []), client.id];
  }
};
