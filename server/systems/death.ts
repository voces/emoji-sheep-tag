import { addSystem } from "../ecs.ts";
import { message } from "../updates.ts";
import { data } from "../st/data.ts";
import { endRound } from "../lobbyApi.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { start } from "../actions/start.ts";
import { lookup } from "./lookup.ts";

// Store auto-start timeouts globally for cleanup
const autoStartTimeouts = new Set<number>();

export const clearAutoStartTimeouts = () => {
  for (const timeout of autoStartTimeouts) {
    clearTimeout(timeout);
  }
  autoStartTimeouts.clear();
};

addSystem((game) => ({
  props: ["health"],
  onChange: (unit) => {
    if (unit.health > 0) return;

    // Handle sheep death logic (previously in sheepDeath.ts)
    if (unit.prefab === "sheep") {
      if (unit.lastAttacker && unit.owner) {
        const killer = lookup(unit.lastAttacker);
        if (killer?.owner) {
          message({
            type: "kill",
            killer: { player: killer.owner, unit: killer.id },
            victim: { player: unit.owner, unit: unit.id },
          });
        }
      }

      if (!data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)) {
        endRound();

        // Auto start
        const lobby = lobbyContext.context;
        const timeoutId = setTimeout(() => {
          autoStartTimeouts.delete(timeoutId);
          if (lobby.host) {
            clientContext.with(
              lobby.host,
              () => lobbyContext.with(lobby, () => start(lobby.host!)),
            );
          }
        }, 250);
        autoStartTimeouts.add(timeoutId);
      }
    }

    // Delete the entity (previously in events/death.ts)
    game.delete(unit);
  },
}));
