import { Audio, AudioLoader, PositionalAudio } from "three";
import { Channel, channels, listener, scene } from "../graphics/three.ts";
import { Entity } from "../ecs.ts";
import { sounds } from "../assets/sounds.ts";
import { z } from "npm:zod";

const audioCache: Record<string, AudioBuffer> = {}; // Cache for loaded audio buffers
const audioLoader = new AudioLoader();

type SoundSet = keyof NonNullable<Entity["sounds"]>;

const routeToBus = (sound: Audio | PositionalAudio, bus: GainNode) => {
  try {
    sound.gain.disconnect();
  } catch (err) {
    console.error(err);
  }

  sound.gain.connect(bus);
};

export const playSoundAt = (
  soundKey: string,
  x: number,
  y: number,
  volume = 1,
) => {
  if (!listener) return;
  const soundPath = sounds[soundKey];
  const sound = new PositionalAudio(listener);
  scene.add(sound);

  const setupSound = () => {
    sound.setBuffer(audioCache[soundPath]);
    sound.setRefDistance(15);
    sound.setRolloffFactor(2);
    sound.setLoop(false);

    const now = listener?.context.currentTime ?? 0;
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, now);
    sound.gain.gain.linearRampToValueAtTime(volume, now + 0.01);

    if (channels.sfx) routeToBus(sound, channels.sfx);
    sound.position.set(x, y, 0);
    sound.play();

    // clean up node after it’s done
    if (sound.source) sound.source.onended = () => sound.removeFromParent();
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
  channel: Channel,
  soundKey: string,
  { volume = 1, loop = false }: { volume?: number; loop?: boolean } = {},
) => {
  if (!listener) return;
  const soundPath = sounds[soundKey];
  const sound = new Audio(listener);
  sound.name = soundKey;
  scene.add(sound);

  const setupSound = () => {
    sound.setBuffer(audioCache[soundPath]);
    sound.setLoop(loop ?? false);

    const now = listener?.context.currentTime ?? 0;
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, now);
    sound.gain.gain.linearRampToValueAtTime(volume, now + 0.01);

    const bus = channels[channel];
    if (bus) routeToBus(sound, bus);

    sound.play();
    if (!loop && sound.source) {
      sound.source.onended = () => sound.removeFromParent();
    }
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
  let choices: ReadonlyArray<string> = [];
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
  y ??= entity.position?.y;
  if (typeof x !== "number" || typeof y !== "number") {
    playSound("sfx", sound, { volume });
    return;
  }

  playSoundAt(sound, x, y, volume);
};

const startAmbient = () => {
  const sound = playSound("ambience", "ambientBirds", {
    volume: 0.05,
    loop: true,
  });
  if (sound) sound.onEnded = () => void 0;

  for (const event of ["pointerdown", "keydown"]) {
    document.removeEventListener(event, startAmbient);
  }
};

for (const event of ["pointerdown", "keydown"]) {
  document.addEventListener(event, startAmbient);
}

const zSoundDetail = z.object({
  path: z.string(),
  volume: z.number().optional(),
  channel: z.union([
    z.literal("master"),
    z.literal("sfx"),
    z.literal("ui"),
    z.literal("ambience"),
  ]).optional(),
});
globalThis.addEventListener("sound", (e) => {
  if (!(e instanceof CustomEvent)) return;
  const result = zSoundDetail.safeParse(e.detail);
  if (!result.success) return;
  const detail = result.data;
  playSound(detail.channel ?? "master", detail.path, { volume: detail.volume });
});
