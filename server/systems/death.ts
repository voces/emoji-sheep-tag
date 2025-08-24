import { data } from "../st/data.ts";
import { endRound } from "../lobbyApi.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { start } from "../actions/start.ts";
import { timeout } from "../api/timing.ts";
import { grantPlayerGold } from "../api/player.ts";
import { lookup } from "./lookup.ts";
import { addSystem } from "@/shared/context.ts";

addSystem((app) => ({
  props: ["health"],
  onChange: (unit) => {
    if (unit.health > 0) return;

    // Grant bounty to killer if entity has bounty and lastAttacker
    if (unit.bounty && unit.lastAttacker) {
      const killer = lookup(unit.lastAttacker);
      if (killer?.owner) grantPlayerGold(killer.owner, unit.bounty);
    }

    if (
      unit.prefab === "sheep" &&
      !data.sheep.some((p) => (p.sheep?.health ?? 0) > 0)
    ) {
      timeout(() => {
        endRound();

        // Auto start
        const lobby = lobbyContext.current;
        setTimeout(() => {
          if (lobby.host) {
            clientContext.with(
              lobby.host,
              () => lobbyContext.with(lobby, () => start(lobby.host!)),
            );
          }
        }, 250);
      }, 0.05);
    }

    app.removeEntity(unit);
  },
}));
