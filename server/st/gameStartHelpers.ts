import type { Game } from "../ecs.ts";
import { newEcs } from "../ecs.ts";
import type { Entity } from "@/shared/types.ts";
import type { LoadedMap } from "@/shared/map.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { generateDoodads, getMapCenter } from "@/shared/map.ts";
import { newUnit } from "../api/unit.ts";
import { playSoundAt } from "../api/sound.ts";
import { getSheepSpawn, getSpiritSpawn } from "./getSheepSpawn.ts";
import { getIdealTime } from "./roundHelpers.ts";
import { colorName } from "@/shared/api/player.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import { clearUpdatesCache, flushUpdates } from "../updates.ts";
import { appContext } from "@/shared/context.ts";
import { practiceModeActions } from "@/shared/data.ts";
import { send } from "../lobbyApi.ts";
import type { Round } from "../lobby.ts";
import { interval, timeout } from "../api/timing.ts";
import { lobbyContext } from "../contexts.ts";

type PlayerLike = {
  id: string;
  name: string;
  playerColor: string;
  sheepCount?: number;
  sheepTime?: number;
  handicap?: number;
  gold?: number;
  team?: "sheep" | "wolf" | "pending" | "observer";
  isPlayer: true;
};

type LobbySettingsLike = {
  mode: string;
  teamGold: boolean;
  startingGold: { sheep: number; wolves: number };
  vipHandicap: number;
  time: number | "auto";
};

type RoundLike = {
  vip?: string;
  duration?: number;
  start?: number;
};

export const createPlayerEntities = <T extends PlayerLike>(
  ecs: Game,
  settings: LobbySettingsLike,
  sheep: T[],
  wolves: T[],
  practice: boolean,
) => {
  const isTeamGold = !practice &&
    (settings.mode === "vip" ||
      (settings.mode === "survival" && settings.teamGold));

  const sheepPlayerGold = isTeamGold
    ? Math.min(20, settings.startingGold.sheep)
    : settings.startingGold.sheep;

  if (isTeamGold) {
    ecs.addEntity({
      id: "team-sheep",
      isTeam: true,
      team: "sheep",
      gold: Math.max(0, settings.startingGold.sheep - 20) *
        sheep.length,
    });
    ecs.addEntity({
      id: "team-wolf",
      isTeam: true,
      team: "wolf",
      gold: settings.startingGold.wolves * wolves.length,
    });
  }

  for (const c of sheep) {
    ecs.addEntity({
      id: c.id,
      name: c.name,
      playerColor: c.playerColor,
      isPlayer: true,
      team: "sheep",
      gold: practice ? 100_000 : sheepPlayerGold,
      sheepCount: settings.mode !== "switch"
        ? (c.sheepCount ?? 0) + 1
        : c.sheepCount,
      sheepTime: settings.mode === "switch" ? 0 : c.sheepTime,
      handicap: c.handicap,
    });
  }

  for (const c of wolves) {
    ecs.addEntity({
      id: c.id,
      name: c.name,
      playerColor: c.playerColor,
      isPlayer: true,
      team: "wolf",
      gold: isTeamGold ? 0 : settings.startingGold.wolves,
      sheepCount: c.sheepCount,
      sheepTime: settings.mode === "switch" ? 0 : c.sheepTime,
      handicap: c.handicap,
    });
  }

  if (practice) {
    ecs.addEntity({
      id: "practice-enemy",
      name: "Enemy",
      isPlayer: true,
      team: "wolf",
      gold: 100_000,
      playerColor: "#ff0000",
    });
  }
};

export const spawnSheepUnits = <T extends { id: string }>(
  sheep: T[],
): Entity[] => {
  const sheepPool: Entity[] = [];
  for (const owner of sheep) {
    sheepPool.push(newUnit(owner.id, "sheep", ...getSheepSpawn()));
  }
  return sheepPool;
};

export const spawnPracticeUnits = (playerId: string): Entity => {
  const sheep = newUnit(playerId, "sheep", ...getSheepSpawn());
  newUnit(playerId, "spirit", ...getSpiritSpawn());
  const { x, y } = getMapCenter();
  const wolf = newUnit(playerId, "wolf", x, y);
  if (wolf.manaRegen) wolf.manaRegen *= 10;

  // Set trueOwner so the player retains control even when transferring ownership
  wolf.trueOwner = playerId;

  // Add practice mode "Give to Enemy" action (will be swapped to "Reclaim" when given)
  if (wolf.actions) {
    wolf.actions = [...wolf.actions, practiceModeActions.giveToEnemy];
  }

  return sheep;
};

const spawnSheep = <T extends { id: string }>(
  sheep: T[],
  practice: boolean,
): Entity[] => {
  if (practice) {
    return sheep.map((owner) => spawnPracticeUnits(owner.id));
  }
  return spawnSheepUnits(sheep);
};

export const setupVipMode = <T extends PlayerLike>(
  round: RoundLike,
  sheep: T[],
  sheepPool: Entity[],
  vipHandicap: number,
  sheepCaptainId?: string,
) => {
  const vip = sheepCaptainId
    ? sheepPool.find((s) => s.owner === sheepCaptainId) ??
      sheepPool[Math.floor(Math.random() * sheepPool.length)]
    : sheepPool[Math.floor(Math.random() * sheepPool.length)];
  vip.buffs = [...(vip.buffs ?? []), {
    model: "vip",
    modelOffset: { y: 0.5 },
  }];
  round.vip = vip.owner;

  for (const player of sheep) {
    if (player.id !== vip.owner) {
      player.handicap = vipHandicap;
    }
  }
};

export const spawnWolves = <T extends { id: string }>(wolves: T[]) => {
  const center = getMapCenter();
  for (const owner of wolves) {
    newUnit(owner.id, "wolf", center.x, center.y);
  }
  playSoundAt(center, Math.random() < 0.5 ? "howl1" : "howl2");
};

export const broadcastCountdown = () => {
  addEntity({
    isTimer: true,
    buffs: [{
      expiration: "Time until sheep spawn:",
      remainingDuration: 3,
      totalDuration: 3,
    }],
  });
  send({ type: "chat", message: "Starting in 3…" });
  timeout(() => send({ type: "chat", message: "Starting in 2…" }), 1);
  timeout(() => send({ type: "chat", message: "Starting in 1…" }), 2);
};

export const broadcastTeamAnnouncement = <T extends PlayerLike>(
  sheep: T[],
  wolves: T[],
) => {
  send({ type: "chat", message: "\u202f" });
  send({
    type: "chat",
    message: `${
      new Intl.ListFormat().format(sheep.map((s) => colorName(s)))
    } vs ${new Intl.ListFormat().format(wolves.map((w) => colorName(w)))}`,
  });
};

export const setupSurvivalTimer = (
  round: RoundLike,
  settings: LobbySettingsLike,
  playerCount: number,
  sheepCount: number,
  onSheepWin: () => void,
) => {
  round.duration = settings.time === "auto"
    ? getIdealTime(playerCount, sheepCount)
    : settings.time;

  addEntity({
    isTimer: true,
    buffs: [{
      expiration: "Time until sheep win:",
      remainingDuration: round.duration,
      totalDuration: round.duration,
    }],
  });

  timeout(onSheepWin, round.duration);
};

export const addWolfSpawnTimer = (duration: number) => {
  addEntity({
    isTimer: true,
    buffs: [{
      expiration: "Time until wolves spawn:",
      remainingDuration: duration,
      totalDuration: duration,
    }],
  });
};

export type InitializeGameOptions<T extends PlayerLike> = {
  map: LoadedMap;
  settings: LobbySettingsLike;
  sheep: T[];
  wolves: T[];
  practice: boolean;
  editor: boolean;
  onSheepWin: () => void;
  sheepCaptainId?: string;
};

export const initializeGame = <T extends PlayerLike>(
  options: InitializeGameOptions<T>,
): Round => {
  const {
    map,
    settings,
    sheep,
    wolves,
    practice,
    editor,
    onSheepWin,
    sheepCaptainId,
  } = options;

  clearUpdatesCache();

  const ecs = newEcs(map);

  // Create round object that will be returned and can be checked/mutated by timeouts
  const round: Round & { active: boolean } = {
    ecs,
    practice,
    editor,
    active: true,
    clearInterval: () => {
      round.active = false;
      clearIntervalFn();
    },
  };

  // Set round early so isEditor() works during entity generation
  lobbyContext.current.round = round;

  let clearIntervalFn: () => void;

  appContext.with(ecs, () =>
    ecs.batch(() => {
      clearIntervalFn = interval(() => {
        ecs.tick++;
        ecs.update();
      }, TICK_RATE);

      generateDoodads(editor ? undefined : ["static", "dynamic"]);

      if (editor) {
        const center = getMapCenter();
        addEntity({
          id: "map-center-marker",
          name: "Center",
          position: { x: center.x, y: center.y },
          model: "atom",
        });
      }

      createPlayerEntities(ecs, settings, sheep, wolves, practice);
      send({ type: "start", updates: flushUpdates(false), practice });

      if (!practice) {
        if (settings.mode !== "switch") {
          broadcastTeamAnnouncement(sheep, wolves);
        }
        broadcastCountdown();
      }

      timeout(() => {
        if (!round.active) return;
        const sheepPool = spawnSheep(sheep, practice);

        if (!practice) {
          if (settings.mode === "vip") {
            setupVipMode(
              round,
              sheep,
              sheepPool,
              settings.vipHandicap,
              sheepCaptainId,
            );
          }
          addWolfSpawnTimer(settings.mode === "switch" ? 2 : 18);
        }
      }, practice ? 0 : 3);

      timeout(() => {
        if (!round.active) return;

        if (!practice) {
          round.start = Date.now();
          spawnWolves(wolves);

          if (settings.mode !== "switch") {
            setupSurvivalTimer(
              round,
              settings,
              sheep.length + wolves.length,
              sheep.length,
              onSheepWin,
            );
          }
        }
      }, practice ? 0 : settings.mode === "switch" ? 5 : 21);
    }));

  return round;
};
