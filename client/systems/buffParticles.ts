import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { Entity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";
import { Buff } from "@/shared/types.ts";

// Track particles by lifetime - one queue per unique lifetime
type ParticleExpiry = {
  particle: Entity;
  expiresAt: number;
};

const particlesByLifetime = new Map<number, ParticleExpiry[]>();

const spawnParticle = (e: Entity, delta: number, time: number) => {
  if (!e.position || e.projectile) return;

  const hostScale = e.modelScale ?? 1;

  // Collect unique buffs with particle systems
  const uniqueBuffs = new Map<string, {
    buff: Buff;
    count: number;
  }>();

  for (const buff of iterateBuffs(e)) {
    if (!buff.model || !buff.particleRate || !buff.particleLifetime) continue;

    // TODO: strings are slow...
    const key = `${buff.model}-${buff.particleRate}-${buff.particleLifetime}-${
      JSON.stringify(buff.modelOffset)
    }-${buff.modelScale}-${buff.particleOffsetRange}-${buff.particleMinOffsetRange}-${buff.particleScaleRange}`;
    const existing = uniqueBuffs.get(key);
    if (existing) {
      existing.count++;
    } else {
      uniqueBuffs.set(key, { buff, count: 1 });
    }
  }

  // Process each unique buff
  for (const { buff, count } of uniqueBuffs.values()) {
    // Calculate probability of spawning particles this frame
    // Multiply by count to handle duplicate buffs
    let spawnProbability = buff.particleRate! * delta * count;

    // Spawn particles while probability allows
    // e.g., probability of 1.4 spawns 1 particle + 40% chance of 2nd
    while (spawnProbability > 0) {
      if (spawnProbability < 1 && Math.random() > spawnProbability) break;
      spawnProbability -= 1;

      // Calculate base position from buff offset
      const baseOffsetX = (buff.modelOffset?.x ?? 0) * hostScale;
      const baseOffsetY = (buff.modelOffset?.y ?? 0) * hostScale;

      // Add random offset if specified
      const minOffsetRange = buff.particleMinOffsetRange ?? 0;
      const maxOffsetRange = buff.particleOffsetRange ?? 0;
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDistance = minOffsetRange +
        Math.random() * (maxOffsetRange - minOffsetRange);
      const randomOffsetX = Math.cos(randomAngle) * randomDistance;
      const randomOffsetY = Math.sin(randomAngle) * randomDistance;

      const position = {
        x: e.position.x + baseOffsetX + randomOffsetX,
        y: e.position.y + baseOffsetY + randomOffsetY,
      };

      // Calculate scale with random variation
      const baseScale = (buff.modelScale ?? 1) * hostScale;
      const scaleRange = buff.particleScaleRange ?? 0;
      const randomScale = baseScale + (Math.random() * 2 - 1) * scaleRange;

      // Create particle
      const particle = addEntity({
        prefab: buff.model,
        position,
        modelScale: randomScale,
        owner: e.owner,
        isDoodad: true,
      });

      // Track expiration by lifetime
      const lifetime = buff.particleLifetime!;
      let queue = particlesByLifetime.get(lifetime);
      if (!queue) {
        queue = [];
        particlesByLifetime.set(lifetime, queue);
      }
      queue.push({
        particle,
        expiresAt: time + lifetime,
      });
    }
  }
};

const cleanupExpiredParticles = (time: number) => {
  // Remove expired particles from each lifetime queue
  for (const queue of particlesByLifetime.values()) {
    let i = 0;
    while (i < queue.length && queue[i].expiresAt <= time) {
      removeEntity(queue[i].particle);
      i++;
    }
    if (i > 0) {
      queue.splice(0, i);
    }
  }
};

const processedThisFrame = new Set<Entity>();

const updateParticles = (e: Entity, delta: number, time: number) => {
  // Deduplicate - skip if already processed this frame
  if (processedThisFrame.has(e)) return;
  processedThisFrame.add(e);

  spawnParticle(e, delta, time);
};

// System for entities with buffs
addSystem({
  props: ["buffs", "position"],
  updateEntity: updateParticles,
  update: (_delta, time) => {
    processedThisFrame.clear();
    cleanupExpiredParticles(time);
  },
});

// System for entities with inventory (for item buff particles)
addSystem({
  props: ["inventory", "position"],
  updateEntity: updateParticles,
});
