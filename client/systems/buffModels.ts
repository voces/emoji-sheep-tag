import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { Entity } from "../ecs.ts";
import { Buff } from "@/shared/types.ts";
import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";

// Track buff model entities for each host entity and buff model
const buffModels = new Map<Entity, Map<string, Entity>>();

const updateBuffModels = (e: Entity) => {
  if (!e.position || e.projectile) return;

  const currentModels = buffModels.get(e) ?? new Map<string, Entity>();
  const newModels = new Map<string, Entity>();

  // Get all unique models from buffs (direct buffs and item buffs) with their offsets
  const modelData = new Map<string, Buff>();
  for (const buff of iterateBuffs(e)) {
    if (buff.model && !buff.particleRate && !modelData.has(buff.model)) {
      modelData.set(buff.model, buff);
    }
  }

  // Get host entity scale (default to 1 if not set)
  const hostScale = e.modelScale ?? 1;

  // Create or reuse entities for each model
  for (const [model, buff] of modelData) {
    // Calculate final scale by multiplying host scale with buff's modelScale
    const buffScale = buff.modelScale ?? 1;
    const finalScale = hostScale * buffScale;

    const offsetX = (buff.modelOffset?.x ?? 0) * hostScale;
    const offsetY = (buff.modelOffset?.y ?? 0) * hostScale;
    const position = {
      x: e.position.x + offsetX,
      y: e.position.y + offsetY,
    };

    const existing = currentModels.get(model);
    if (existing) {
      // Update position, modelScale, and owner of existing model
      existing.position = position;
      existing.modelScale = finalScale;
      if (e.owner !== undefined) existing.owner = e.owner;
      existing.alpha = buff.modelAlpha;
      existing.playerColor = buff.modelPlayerColor;
      newModels.set(model, existing);
    } else {
      // Create new model entity
      const modelEntity = addEntity({
        prefab: model,
        position,
        modelScale: finalScale,
        owner: e.owner,
        isDoodad: true,
        playerColor: buff.modelPlayerColor,
        alpha: buff.modelAlpha,
      });
      newModels.set(model, modelEntity);
    }
  }

  // Remove models that are no longer needed
  for (const [model, entity] of currentModels) {
    if (!newModels.has(model)) removeEntity(entity);
  }

  // Update tracking
  if (newModels.size > 0) buffModels.set(e, newModels);
  else buffModels.delete(e);
};

const removeBuffModels = (e: Entity) => {
  const models = buffModels.get(e);
  if (!models) return;

  for (const entity of models.values()) removeEntity(entity);
  buffModels.delete(e);
};

// System for entities with buffs
addSystem({
  props: ["buffs", "position"],
  onAdd: updateBuffModels,
  onChange: updateBuffModels,
  onRemove: removeBuffModels,
});

// System for entities with inventory (for item buff models)
addSystem({
  props: ["inventory", "position"],
  onAdd: updateBuffModels,
  onChange: updateBuffModels,
  onRemove: removeBuffModels,
});
