import { endRound } from "../lobbyApi.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { start } from "../actions/start.ts";
import { timeout } from "../api/timing.ts";
import { grantPlayerGold } from "../api/player.ts";
import { lookup } from "./lookup.ts";
import { addSystem } from "@/shared/context.ts";
import { getSheep } from "./sheep.ts";
import { newUnit, orderAttack } from "../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { getPlayerUnits } from "./playerEntities.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { isPractice } from "../api/st.ts";
import { getTeams } from "@/shared/systems/teams.ts";

const onLose = () =>
  timeout(() => {
    endRound();

    // Auto start
    const lobby = lobbyContext.current;
    setTimeout(() => {
      if (lobby.host) {
        clientContext.with(
          lobby.host,
          () =>
            lobbyContext.with(
              lobby,
              () => start(lobby.host!, { type: "start" }),
            ),
        );
      }
    }, 250);
  }, 0.05);

const onSheepDeath = (sheep: Entity) => {
  if (!sheep.owner) return;

  for (const entity of getPlayerUnits(sheep.owner)) {
    if (entity.prefab === "sheep" || !entity.health) continue;
    entity.health = 0;
  }

  if (
    !getSheep().some((u) => u.health) &&
    !isPractice()
  ) return onLose();

  const unitKiller = sheep.lastAttacker;
  const playerKiller = unitKiller ? lookup(unitKiller)?.owner : undefined;
  for (const wolf of getTeams().wolves) {
    grantPlayerGold(wolf.owner, wolf.owner === playerKiller ? 40 : 15);
  }

  if (isPractice()) {
    const newSheep = newUnit(sheep.owner, "sheep", ...getSheepSpawn());
    if (sheep.lastAttacker) {
      const attacker = lookup(sheep.lastAttacker);
      if (attacker) orderAttack(attacker, newSheep);
    }
  } else newUnit(sheep.owner, "spirit", ...getSpiritSpawn());
};

addSystem((app) => ({
  props: ["health"],
  onChange: (unit) => {
    if (unit.health > 0) return;

    // Grant bounty to killer if entity has bounty and lastAttacker
    if (unit.bounty && unit.lastAttacker) {
      const killer = lookup(unit.lastAttacker);
      if (killer?.owner) grantPlayerGold(killer.owner, unit.bounty);
    }

    if (unit.prefab === "sheep") onSheepDeath(unit);

    app.removeEntity(unit);
  },
}));
