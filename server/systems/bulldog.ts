import { addSystem } from "@/shared/context.ts";
import { lobbyContext } from "../contexts.ts";
import { endRound, send } from "../lobbyApi.ts";
import { getEndAreas } from "@/shared/penAreas.ts";
import { Entity } from "@/shared/types.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { playSoundAt } from "../api/sound.ts";
import { redistributeSheepGold } from "../api/player.ts";
import { colorName, getPlayer } from "@/shared/api/player.ts";
import { getSheep } from "./collections.ts";
import { isPractice } from "../api/st.ts";
import { App } from "@verit/ecs";

const PARTICLE_COUNT = 16;
const PARTICLE_LIFETIME = 0.6;
const PARTICLE_MIN_SPEED = 2;
const PARTICLE_MAX_SPEED = 3.5;
/** Brief window over which the spawner emits its particles. Visually instantaneous. */
const BURST_DURATION = 0.05;

const isInEndArea = (x: number, y: number): boolean =>
  getEndAreas().some((a) =>
    x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height
  );

/** Spawn a brief sparkle emitter; the buff dies in BURST_DURATION but particles outlive it via particleLifetime. */
const burstParticles = (cx: number, cy: number, ownerId: string) => {
  addEntity({
    id: `bulldog-burst-${Date.now()}-${Math.random()}`,
    owner: ownerId,
    position: { x: cx, y: cy },
    isDoodad: true,
    buffs: [{
      remainingDuration: BURST_DURATION,
      totalDuration: BURST_DURATION,
      expiration: "SFX",
      model: "sparkle",
      modelScale: 0.5,
      particleRate: PARTICLE_COUNT / BURST_DURATION,
      particleLifetime: PARTICLE_LIFETIME,
      particleMinOffsetRange: 0.25,
      particleOffsetRange: 0.25,
      particleMinSpeed: PARTICLE_MIN_SPEED,
      particleMaxSpeed: PARTICLE_MAX_SPEED,
      particleScaleRange: 0.2,
      particleUseOwnerColor: true,
    }],
  });
};

const recordReachEnd = (sheepOwnerId: string) => {
  const round = lobbyContext.current.round;
  if (!round) return;
  (round.events ??= []).push({
    type: "goal",
    player: sheepOwnerId,
    time: Date.now() - (round.start ?? Date.now()),
  });
};

const insideByApp = new WeakMap<App<Entity>, Set<string>>();
const getInsideSet = (app: App<Entity>): Set<string> => {
  let set = insideByApp.get(app);
  if (!set) {
    set = new Set();
    insideByApp.set(app, set);
  }
  return set;
};

const onSheepReachedEnd = (sheep: Entity) => {
  if (!sheep.position || !sheep.owner) return;

  const { x, y } = sheep.position;
  burstParticles(x, y, sheep.owner);
  playSoundAt({ x, y }, "chimes1");

  if (isPractice()) return;

  const player = getPlayer(sheep.owner);
  send({
    type: "chat",
    message: `${player ? colorName(player) : sheep.owner} reached the end!`,
  });
  recordReachEnd(sheep.owner);
  redistributeSheepGold(sheep.owner);
  removeEntity(sheep);

  // If every sheep has made it, the sheep team wins.
  if (!getSheep().some((s) => s.health && s.health > 0 && s !== sheep)) {
    send({ type: "chat", message: "Sheep win!" });
    endRound();
  }
};

addSystem((app) => ({
  props: ["prefab", "position"],
  updateEntity: (entity) => {
    const lobby = lobbyContext.current;
    if (lobby.settings.mode !== "bulldog") return;
    if (entity.prefab !== "sheep") return;
    if (!entity.position) return;
    const inside = getInsideSet(app);
    const isInside = isInEndArea(entity.position.x, entity.position.y);
    if (!isInside) {
      inside.delete(entity.id);
      return;
    }
    if (inside.has(entity.id)) return;
    inside.add(entity.id);
    onSheepReachedEnd(entity);
  },
  onRemove: (entity) => {
    insideByApp.get(app)?.delete(entity.id);
  },
}));
