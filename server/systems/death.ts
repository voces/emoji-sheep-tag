import { endRound, send } from "../lobbyApi.ts";
import { lobbyContext } from "../contexts.ts";
import { timeout } from "../api/timing.ts";
import { grantPlayerGold, sendPlayerGold } from "../api/player.ts";
import { lookup } from "./lookup.ts";
import { addSystem } from "@/shared/context.ts";
import { getSheep } from "./sheep.ts";
import { distributeEquitably } from "../util/equitableDistribution.ts";
import { newUnit, orderAttack } from "../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { debouncedGoldText } from "../api/floatingText.ts";
import { findPlayerUnit, getPlayerUnits } from "./playerEntities.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { isPractice } from "../api/st.ts";
import { getTeams } from "@/shared/systems/teams.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { newSfx } from "../api/sfx.ts";
import { isEnemy, isStructure, iterateBuffs } from "@/shared/api/unit.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { colorName, getPlayer } from "@/shared/api/player.ts";
import { getMapCenter } from "@/shared/map.ts";
import { PATHING_NONE } from "@/shared/constants.ts";

const onLose = () =>
  timeout(() => {
    const lobby = lobbyContext.current;

    send({
      type: "chat",
      message: `${
        new Intl.ListFormat().format(
          Array.from(getTeams().sheep).map((s) =>
            colorName({
              color: s.playerColor ?? "#ffffff",
              name: s.name ?? "<unknown>",
            })
          ),
        )
      } lasted ${
        formatDuration(Date.now() - (lobby.round?.start ?? Date.now()))
      }!`,
    });
    endRound();
  }, 0.05);

const handleSwitchDeath = (sheep: Entity) => {
  const killingPlayer = getPlayer(lookup(sheep.lastAttacker)?.owner);
  const victimPlayer = getPlayer(sheep.owner);
  if (!killingPlayer || !victimPlayer) return;

  const lobby = lobbyContext.current;

  // Killer
  killingPlayer.team = "sheep";
  if (lobby.settings.startingGold.sheep) {
    grantPlayerGold(killingPlayer.id, lobby.settings.startingGold.sheep);
  }
  for (const entity of getPlayerUnits(killingPlayer.id)) {
    if (entity.prefab === "wolf" || entity.prefab === "fox") {
      removeEntity(entity);
    }
  }
  newUnit(
    killingPlayer.id,
    "sheep",
    sheep.position?.x ?? 0,
    sheep.position?.y ?? 0,
  );

  // Victim
  victimPlayer.team = "wolf";
  if (lobby.settings.startingGold.wolves) {
    grantPlayerGold(victimPlayer.id, lobby.settings.startingGold.wolves);
  }
  for (const entity of getPlayerUnits(victimPlayer.id)) {
    if (isStructure(entity)) entity.health = 0;
  }
  const { x, y } = getMapCenter();
  newUnit(victimPlayer.id, "wolf", x, y);

  // Send switch message
  send({
    type: "chat",
    message: `${
      colorName({
        color: killingPlayer.playerColor ?? "#ffffff",
        name: killingPlayer.name ?? "<unknown>",
      })
    } switched with ${
      colorName({
        color: victimPlayer.playerColor ?? "#ffffff",
        name: victimPlayer.name ?? "<unknown>",
      })
    }!`,
  });
};

const onSheepDeath = (sheep: Entity) => {
  const lobby = lobbyContext.current;

  if (lobby.settings.mode === "switch" && !isPractice()) {
    return handleSwitchDeath(sheep);
  }

  if (!sheep.owner) return;

  for (const entity of getPlayerUnits(sheep.owner)) {
    if (entity.prefab === "sheep" || !entity.health) continue;
    entity.health = 0;
  }

  const roundOver = lobby.settings.mode === "vip"
    ? lobby.round?.vip === sheep.owner
    : !getSheep().some((u) => u.health);

  if (roundOver && !isPractice()) return onLose();

  const killingPlayerId = lookup(sheep.lastAttacker)?.owner;
  const killingPlayer = getPlayer(killingPlayerId);

  const victimPlayer = getPlayer(sheep.owner);

  // Send kill message only if not the last sheep
  if (!roundOver && !isPractice() && killingPlayer && victimPlayer) {
    send({
      type: "chat",
      message: `${
        colorName({
          color: killingPlayer.playerColor ?? "#ffffff",
          name: killingPlayer.name ?? "<unknown>",
        })
      } killed ${
        colorName({
          color: victimPlayer.playerColor ?? "#ffffff",
          name: victimPlayer.name ?? "<unknown>",
        })
      }`,
    });
  }

  for (const wolf of getTeams().wolves) {
    const bounty = (wolf.owner === killingPlayerId ? 40 : 15) *
      lobbyContext.current.settings.income.wolves;
    grantPlayerGold(wolf.id, bounty);
    const wolfUnit = findPlayerUnit(wolf.id, (fn) => fn.prefab === "wolf");
    if (wolfUnit) debouncedGoldText(wolfUnit, bounty);
  }

  if (isPractice()) {
    const newSheep = newUnit(sheep.owner, "sheep", ...getSheepSpawn());
    if (sheep.lastAttacker) {
      const attacker = lookup(sheep.lastAttacker);
      if (attacker) orderAttack(attacker, newSheep);
    }
  } else {
    const location: [number, number] = lobby.settings.mode === "vip"
      ? [sheep.position?.x ?? 0, sheep.position?.y ?? 0]
      : getSpiritSpawn();
    newUnit(
      sheep.owner,
      "spirit",
      ...location,
      lobby.settings.mode === "vip"
        ? {
          requiresPathing: PATHING_NONE,
          blocksPathing: PATHING_NONE,
          facing: sheep.facing,
        }
        : undefined,
    );

    const dyingSheepGold = getPlayer(sheep.owner)?.gold ?? 0;
    if (dyingSheepGold > 0) {
      const survivingAllies = Array.from(getSheep())
        .filter((s) => s.health && s.health > 0 && s.owner !== sheep.owner);

      if (survivingAllies.length > 0) {
        const currentGold = survivingAllies.map((ally) =>
          getPlayer(ally.owner)?.gold ?? 0
        );
        const shares = distributeEquitably(dyingSheepGold, currentGold);

        for (let i = 0; i < survivingAllies.length; i++) {
          const ally = survivingAllies[i];
          const share = shares[i];
          if (!ally.owner || share === 0) continue;

          sendPlayerGold(sheep.owner, ally.owner, share);
        }
      }
    }
  }
};

addSystem((app) => ({
  props: ["health"],
  onChange: (unit) => {
    if (unit.health > 0) return;

    // Grant bounty to killer if entity has bounty and lastAttacker
    if (unit.bounty && unit.lastAttacker) {
      const killer = lookup(unit.lastAttacker);
      if (killer?.owner && isEnemy(killer, unit)) {
        let bounty = unit.bounty *
          lobbyContext.current.settings.income.wolves;

        // Apply bounty multiplier and bonus from killer's buffs and item buffs (e.g., Scythe)
        // Formula: bounty * multiplier + bonus (so 2x+1 means bounty * 2 + 1)
        // Examples: 1 bounty with 2x+1 → 3, 2 bounty with 2x+1 → 5
        let totalBountyMultiplier = 0;
        let totalBountyBonus = 0;

        // Add bounty multipliers and bonuses from all buffs (direct + item buffs)
        for (const buff of iterateBuffs(killer)) {
          if (buff.bountyMultiplier) {
            totalBountyMultiplier += buff.bountyMultiplier;
          }
          if (buff.bountyBonus) {
            totalBountyBonus += buff.bountyBonus;
          }
        }

        if (totalBountyMultiplier > 0 || totalBountyBonus > 0) {
          bounty = bounty * totalBountyMultiplier + totalBountyBonus;
        }

        grantPlayerGold(killer.owner, bounty);
        debouncedGoldText(killer, bounty);
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
