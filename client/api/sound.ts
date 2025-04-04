import { Audio, AudioLoader, PositionalAudio } from "three";
import { listener } from "../graphics/three.ts";
import { scene } from "../graphics/three.ts";
import { Entity } from "../ecs.ts";
import { sounds } from "../assets/sounds.ts";

const audioCache: Record<string, AudioBuffer> = {}; // Cache for loaded audio buffers
const audioLoader = new AudioLoader();

type SoundSet = keyof NonNullable<Entity["sounds"]>;

export const playSoundAt = (
  soundKey: string,
  x: number,
  y: number,
  volume = 1,
) => {
  const soundPath = sounds[soundKey];
  const sound = new PositionalAudio(listener);
  scene.add(sound);

  const setupSound = () => {
    sound.setBuffer(audioCache[soundPath]);
    sound.setRefDistance(15);
    sound.setRolloffFactor(5);
    sound.setLoop(false);
    sound.setVolume(volume);
    sound.position.set(x, y, 0);
    sound.play();
    sound.onEnded = () => sound.removeFromParent();
  };

  if (audioCache[soundPath]) {
    setupSound();
    return sound;
  }

  audioLoader.load(soundPath, (buffer) => {
    audioCache[soundPath] = buffer;
    setupSound();
  });

  return sound;
};

export const playSound = (
  soundKey: string,
  { volume = 1, loop = false }: { volume?: number; loop?: boolean } = {},
) => {
  const soundPath = sounds[soundKey];
  const sound = new Audio(listener);
  scene.add(sound);

  const setupSound = () => {
    sound.setBuffer(audioCache[soundPath]);
    sound.setLoop(loop);
    sound.setVolume(volume);
    sound.gain.gain.setValueAtTime(volume, 0);
    sound.play();
    if (!loop) sound.onEnded = () => sound.removeFromParent();
  };

  if (audioCache[soundPath]) {
    setupSound();
    return sound;
  }

  audioLoader.load(soundPath, (buffer) => {
    audioCache[soundPath] = buffer;
    setupSound();
  });

  return sound;
};

const getSoundFromSet = (entity: Entity, ...sets: SoundSet[]) => {
  let choices: string[] = [];
  for (let i = 0; i < sets.length && !choices.length; i++) {
    choices = entity.sounds?.[sets[i]] ?? [];
  }
  if (!choices.length) return;
  return choices[Math.floor(Math.random() * choices.length)];
};

export const playEntitySound = (
  entity: Entity,
  sets: SoundSet | SoundSet[],
  { volume, x, y }: { volume?: number; x?: number; y?: number } = {},
) => {
  const sound = getSoundFromSet(
    entity,
    ...(Array.isArray(sets) ? sets : [sets]),
  );
  if (!sound) return;

  x ??= entity.position?.x;
  if (typeof x !== "number") return;

  y ??= entity.position?.y;
  if (typeof y !== "number") return;

  playSoundAt(sound, x, y, volume);
};

const startAmbient = () => {
  const sound = playSound("ambientBirds", { volume: 0.05, loop: true });
  sound.onEnded = () => void 0;

  document.removeEventListener("click", startAmbient);
  document.removeEventListener("keydown", startAmbient);
  document.removeEventListener("touchstart", startAmbient);
};

document.addEventListener("click", startAmbient);
document.addEventListener("keydown", startAmbient);
document.addEventListener("touchstart", startAmbient);
