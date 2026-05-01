import { Entity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";
import { Buff } from "@/shared/types.ts";
import { ParticleEmitter, svgToTexture } from "../graphics/ParticleEmitter.ts";
import { getModelScale, svgs } from "./models.ts";
import { getPlayer } from "@/shared/api/player.ts";

const readyEmitters = new Map<string, ParticleEmitter>();
const pendingEmitters = new Set<string>();
const svgScales = new Map<string, number>();

const extractViewBoxMax = (svg: string): number => {
  const match = svg.match(/viewBox="[^"]*\s([\d.]+)\s([\d.]+)"/);
  if (!match) return 1;
  return Math.max(parseFloat(match[1]), parseFloat(match[2]));
};

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const hexToLinearRgb = (hex: string): [number, number, number] => [
  srgbToLinear(parseInt(hex.slice(1, 3), 16) / 255),
  srgbToLinear(parseInt(hex.slice(3, 5), 16) / 255),
  srgbToLinear(parseInt(hex.slice(5, 7), 16) / 255),
];

const extractFill = (svg: string): string => {
  const match = svg.match(/fill="(#[0-9a-fA-F]{6})"/);
  return match?.[1] ?? "#ffffff";
};

const getEmitter = (model: string): ParticleEmitter | undefined => {
  const ready = readyEmitters.get(model);
  if (ready) return ready;

  if (pendingEmitters.has(model)) return undefined;
  pendingEmitters.add(model);

  const svg = svgs[model];
  const registrationScale = getModelScale(model);
  if (!svg || registrationScale == null) return undefined;

  svgScales.set(model, extractViewBoxMax(svg) * registrationScale / 72);

  const emitter = new ParticleEmitter();
  svgToTexture(svg).then((tex) => {
    emitter.setTexture(tex);
    readyEmitters.set(model, emitter);
  });

  return undefined;
};

const processedThisFrame = new Set<Entity>();

const updateParticles = (e: Entity, delta: number, time: number) => {
  if (processedThisFrame.has(e)) return;
  processedThisFrame.add(e);

  if (!e.position || e.projectile) return;

  const hostScale = e.modelScale ?? 1;

  // Collect unique buffs with particle systems
  const uniqueBuffs = new Map<string, {
    buff: Buff;
    count: number;
  }>();

  for (const buff of iterateBuffs(e)) {
    if (!buff.model || !buff.particleRate || !buff.particleLifetime) continue;

    const key = `${buff.model}-${buff.particleRate}-${buff.particleLifetime}-${
      JSON.stringify(buff.modelOffset)
    }-${buff.modelScale}-${buff.particleOffsetRange}-${buff.particleMinOffsetRange}-${buff.particleScaleRange}-${buff.particleMinSpeed}-${buff.particleMaxSpeed}`;
    const existing = uniqueBuffs.get(key);
    if (existing) existing.count++;
    else uniqueBuffs.set(key, { buff, count: 1 });
  }

  for (const { buff, count } of uniqueBuffs.values()) {
    const emitter = getEmitter(buff.model!);
    if (!emitter) continue;
    const svg = svgs[buff.model!];
    // Opt-in: a buff with particleUseOwnerColor inherits the owner's player
    // color (used for bulldog reach-the-end sparkles); otherwise we fall back
    // to the SVG fill so existing buffs (e.g. crimsonArc) stay their natural color.
    const ownerColor = buff.particleUseOwnerColor && e.owner
      ? getPlayer(e.owner)?.playerColor ?? e.playerColor
      : undefined;
    const color = ownerColor
      ? hexToLinearRgb(ownerColor)
      : svg
      ? hexToLinearRgb(extractFill(svg))
      : [1, 1, 1] as [number, number, number];

    let spawnProbability = buff.particleRate! * delta * count;

    while (spawnProbability > 0) {
      if (spawnProbability < 1 && Math.random() > spawnProbability) break;
      spawnProbability -= 1;

      const baseOffsetX = (buff.modelOffset?.x ?? 0) * hostScale;
      const baseOffsetY = (buff.modelOffset?.y ?? 0) * hostScale;

      const minOffsetRange = buff.particleMinOffsetRange ?? 0;
      const maxOffsetRange = buff.particleOffsetRange ?? 0;
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDistance = minOffsetRange +
        Math.random() * (maxOffsetRange - minOffsetRange);

      const x = e.position.x + baseOffsetX +
        Math.cos(randomAngle) * randomDistance;
      const y = e.position.y + baseOffsetY +
        Math.sin(randomAngle) * randomDistance;

      const baseScale = (buff.modelScale ?? 1) * hostScale *
        svgScales.get(buff.model!)!;
      const scaleRange = (buff.particleScaleRange ?? 0) *
        svgScales.get(buff.model!)!;
      const startScale = baseScale + (Math.random() * 2 - 1) * scaleRange;

      const minSpeed = buff.particleMinSpeed ?? 0;
      const maxSpeed = buff.particleMaxSpeed ?? minSpeed;
      const radial = minSpeed > 0 || maxSpeed > 0;
      const speed = radial
        ? minSpeed + Math.random() * (maxSpeed - minSpeed)
        : 0;
      const vx = radial ? Math.cos(randomAngle) * speed : 0;
      const vy = radial
        ? Math.sin(randomAngle) * speed
        : 0.4 + Math.random() * 0.2;
      const rotation = radial ? randomAngle : Math.PI / 2;

      emitter.emit({
        time,
        x,
        y,
        vx,
        vy,
        startScale,
        endScale: startScale,
        lifetime: buff.particleLifetime!,
        color,
        alpha: 1,
        rotation,
      });
    }
  }
};

addSystem({
  props: ["buffs", "position"],
  updateEntity: updateParticles,
  update: (_delta, time) => {
    processedThisFrame.clear();
    for (const emitter of readyEmitters.values()) emitter.update(time);
  },
});

addSystem({
  props: ["inventory", "position"],
  updateEntity: updateParticles,
});
