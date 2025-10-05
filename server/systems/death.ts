import { endRound, send } from "../lobbyApi.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { start } from "../actions/start.ts";
import { timeout } from "../api/timing.ts";
import { grantPlayerGold } from "../api/player.ts";
import { lookup } from "./lookup.ts";
import { addSystem } from "@/shared/context.ts";
import { getSheep } from "./sheep.ts";
import { newUnit, orderAttack } from "../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { newGoldText } from "../api/floatingText.ts";
import { findPlayerUnit, getPlayerUnits } from "./playerEntities.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { isPractice } from "../api/st.ts";
import { getTeams } from "@/shared/systems/teams.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { newSfx } from "../api/sfx.ts";
import { isEnemy } from "@/shared/api/unit.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { colorName } from "@/shared/api/player.ts";

const onLose = () =>
  timeout(() => {
    const lobby = lobbyContext.current;

    send({
      type: "chat",
      message: `Wolves win! ${
        new Intl.ListFormat().format(
          Array.from(getTeams().sheep).map((s) =>
            colorName({
              color: s.playerColor ?? "#ffffff",
              name: s.name ?? "<unknown>",
            })
          ),
        )
      } lasted ${formatDuration(Date.now() - lobby.round!.start)}!`,
    });
    endRound();

    // Auto start
    setTimeout(() => {
      if (!lobby.host) return;
      clientContext.with(
        lobby.host,
        () =>
          lobbyContext.with(
            lobby,
            () => start(lobby.host!, { type: "start" }),
          ),
      );
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
    const bounty = (wolf.owner === playerKiller ? 40 : 15) *
      lobbyContext.current.settings.income.wolves;
    grantPlayerGold(wolf.owner, bounty);
    const wolfUnit = findPlayerUnit(wolf.owner, (fn) => fn.prefab === "wolf");
    if (wolfUnit?.position) {
      newGoldText(
        { x: wolfUnit.position.x, y: wolfUnit.position.y + 0.5 },
        bounty,
      );
    }
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
      if (killer?.owner && isEnemy(killer, unit)) {
        const bounty = unit.bounty *
          lobbyContext.current.settings.income.wolves;
        grantPlayerGold(killer.owner, bounty);
        if (killer.position) {
          newGoldText(
            { x: killer.position.x, y: killer.position.y + 0.5 },
            bounty,
          );
        }
      }
    }

    if (unit.prefab === "sheep") onSheepDeath(unit);

    // Spawn tree stump when tree dies
    if (unit.prefab === "tree" && unit.position) {
      addEntity({
        prefab: "treeStump",
        position: unit.position,
        facing: unit.facing,
        modelScale: unit.modelScale,
        maxHealth: 45,
        healthRegen: -1,
      });
      for (
        const { x, y, scale } of [
          { x: 0.35, y: 0.25, scale: 0.8 },
          { x: -0.35, y: 0.1, scale: 0.8 },
          { x: 0, y: 0.65, scale: 2 },
        ]
      ) {
        const sfx = newSfx(
          { x: unit.position.x + x, y: unit.position.y + y },
          "fire",
          undefined,
          1,
          "ease-out",
        );
        sfx.modelScale = scale;
      }
    }

    // Spawn tree when tree stump dies
    if (unit.prefab === "treeStump" && unit.position) {
      addEntity({
        prefab: "tree",
        position: unit.position,
        facing: unit.facing,
        modelScale: unit.modelScale,
        progress: 0.11,
        completionTime: 1.5,
      });
    }

    app.removeEntity(unit);
  },
}));
