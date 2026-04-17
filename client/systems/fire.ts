import { isStructure } from "@/shared/api/unit.ts";
import { addSystem } from "@/shared/context.ts";
import { app, Entity } from "../ecs.ts";
import { playSoundAt } from "../api/sound.ts";
import { PositionalAudio } from "three";
import { ParticleEmitter } from "../graphics/ParticleEmitter.ts";
import { camera } from "../graphics/three.ts";

type FireState = {
  entity: Entity;
  smokeAcc: number;
  grey: number;
  greyCenter: number;
  scale: number;
};

const fires = new WeakMap<Entity, FireState[]>();
const fireOffsetsMap = new WeakMap<Entity, { x: number; y: number }[]>();
const smokeEmitter = new ParticleEmitter();
const fireSoundPool: PositionalAudio[] = [];

const getFires = (entity: Entity) => {
  if ((entity.health ?? 0) <= 0) return 0;
  const maxHealth = entity.maxHealth ?? 1;
  if (maxHealth <= 0) return 0;
  const expectedHealth = typeof entity.progress === "number"
    ? maxHealth * entity.progress
    : maxHealth;
  const missingHealthRatio = Math.max(
    0,
    (expectedHealth - (entity.health ?? 0)) / maxHealth,
  );
  const maxFires = entity.tilemap &&
      entity.tilemap.width <= 2 && entity.tilemap.height <= 2
    ? 1
    : 3;
  return Math.min(Math.round(missingHealthRatio * maxFires), maxFires);
};

const generateFireOffsets = () => {
  const offsets: { x: number; y: number }[] = [];
  const baseAngle = Math.random() * Math.PI * 2;

  for (let i = 0; i < 3; i++) {
    const minAngle = baseAngle + i * (2 * Math.PI / 3);
    const angle = minAngle + (Math.random() - 0.5) * 0.5;
    const dist = 0.45 + Math.random() * 0.2;
    offsets.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
  }

  return offsets;
};

const fireVolumes = [0, 0.02, 0.04, 0.06];
const MAX_FIRE_SOUNDS = 20;

const distToCamera = (e: Entity) => {
  if (!e.position) return Infinity;
  const dx = e.position.x - camera.position.x;
  const dy = e.position.y - camera.position.y;
  return dx * dx + dy * dy;
};

const reassignFireSounds = () => {
  const sorted = [...allFires]
    .filter((e) => fires.get(e)?.length && e.position)
    .sort((a, b) => distToCamera(a) - distToCamera(b));

  const targets = sorted.slice(0, MAX_FIRE_SOUNDS);

  // Grow pool if needed
  while (fireSoundPool.length < targets.length) {
    const sound = playSoundAt("fire1", 0, 0, 0, {
      loop: true,
      channel: "ambience",
      refDistance: 10,
    });
    if (sound) fireSoundPool.push(sound);
    else break;
  }

  // Assign each pool sound to a target, or mute unused ones
  for (let i = 0; i < fireSoundPool.length; i++) {
    const sound = fireSoundPool[i];
    const target = targets[i];
    const now = sound.context.currentTime;
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, now);

    if (target?.position) {
      const fireCount = fires.get(target)?.length ?? 0;
      const vol = fireVolumes[fireCount] ?? fireVolumes[3];
      sound.position.set(target.position.x, target.position.y, 0);
      sound.gain.gain.linearRampToValueAtTime(vol, now + 0.3);
    } else {
      sound.gain.gain.linearRampToValueAtTime(0, now + 0.3);
    }
  }
};

const updateFires = (e: Entity, remove = false) => {
  if (!isStructure(e)) return;
  const fireCount = remove ? 0 : getFires(e);
  let existing = fires.get(e);
  if (!existing) {
    if (fireCount === 0) return;
    existing = [];
    fires.set(e, existing);
  }
  if (e.position) {
    let offsets = fireOffsetsMap.get(e);
    if (!offsets) {
      offsets = generateFireOffsets();
      fireOffsetsMap.set(e, offsets);
    }
    const radius = e.radius ?? 0.5;
    const scale = 0.7 + radius * 0.6;
    for (let i = existing.length; i < fireCount; i++) {
      const center = 60 + Math.floor(Math.random() * 136);
      existing.push({
        entity: app.addEntity({
          id: `fire-${crypto.randomUUID()}`,
          prefab: "fire",
          position: {
            x: e.position.x + offsets[i].x * radius,
            y: e.position.y + offsets[i].y * radius,
          },
          modelScale: scale,
          zIndex: 0.05 + i * 0.01,
          isDoodad: true,
          isEffect: true,
        }),
        smokeAcc: 0,
        grey: center,
        greyCenter: center,
        scale,
      });
    }
  }
  for (let i = fireCount; i < existing.length; i++) {
    if (existing[i]) app.removeEntity(existing[i].entity);
  }
  if (fireCount === 0) {
    fires.delete(e);
  } else {
    existing.splice(fireCount);
  }
};

const allFires = new Set<Entity>();

app.addSystem({
  props: ["health", "maxHealth"],
  onAdd: (e) => {
    updateFires(e);
    if (fires.has(e)) allFires.add(e);
  },
  onChange: (e) => {
    updateFires(e);
    if (fires.has(e)) allFires.add(e);
    else allFires.delete(e);
  },
  onRemove: (e) => {
    updateFires(e, true);
    allFires.delete(e);
  },
});

let soundReassignAcc = 0;

addSystem({
  update: (delta, time) => {
    smokeEmitter.update(time);

    soundReassignAcc += delta;
    if (soundReassignAcc >= 0.5) {
      soundReassignAcc = 0;
      reassignFireSounds();
    }

    for (const owner of allFires) {
      const fireStates = fires.get(owner);
      if (!fireStates) continue;
      for (const state of fireStates) {
        const pull = (state.greyCenter - state.grey) * 0.5 * delta;
        state.grey = Math.max(
          0,
          Math.min(255, state.grey + pull + (Math.random() - 0.5) * delta * 60),
        );
        state.smokeAcc += delta;
        if (state.smokeAcc >= 0.15 + Math.random() * 0.1) {
          state.smokeAcc = 0;
          const pos = state.entity.position;
          if (!pos) continue;

          const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const speed = 0.3 + Math.random() * 0.4;
          const startScale = (0.08 + Math.random() * 0.1) * state.scale;
          const grey = Math.max(
            0,
            Math.min(
              255,
              Math.round(
                state.grey + (Math.random() - 0.5) * 60,
              ),
            ),
          );
          const g = grey / 255;

          smokeEmitter.emit({
            time,
            x: pos.x + (Math.random() - 0.5) * 0.3,
            y: pos.y + (Math.random() - 0.5) * 0.3,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            startScale,
            endScale: startScale * 2.5,
            lifetime: 1.5 + Math.random() * 1.0,
            color: [g, g, g],
            alpha: 0.5,
          });
        }
      }
    }
  },
});
