import { Entity } from "../ecs.ts";
import { appContext } from "@/shared/context.ts";
import { getEntitiesInRect } from "@/shared/systems/kd.ts";
import { getLocalPlayer } from "../api/player.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { editorVar } from "@/vars/editor.ts";
import { hasAllyActions } from "../util/allyPermissions.ts";
import {
  clearSelection,
  DOUBLE_CLICK_SELECTION_RADIUS,
  selectEntitiesByPrefabInRadius,
  selectEntity,
} from "../api/selection.ts";
import { checkShortcut } from "./keyboardHandlers.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";

// Selection drag state
export let dragStart: { x: number; y: number } | null = null;
export let selectionEntity: Entity | null = null;

// Double click tracking
export const DOUBLE_CLICK_THRESHOLD_MS = 300;
export let lastEntityClickTime = 0;
export let lastClickedEntity: Entity | null = null;

// Pending entity click state (for mouse-up selection)
export let pendingEntityClick: {
  entity: Entity;
  time: number;
  startPixels: { x: number; y: number };
} | null = null;

// Preview glow for drag selection - use per-entity buffs for correct scaling
type PreviewGlowBuff = {
  model: "glow";
  modelScale: number;
  modelAlpha: number;
  modelPlayerColor: string;
};
type StoredGlow = { preview: PreviewGlowBuff; hidden: readonly unknown[] };
const previewGlowBuffs = new Map<Entity, StoredGlow>();

export const clearPreviewGlow = () => {
  for (const [entity, { preview, hidden }] of previewGlowBuffs) {
    // Remove preview glow and restore hidden glow buffs
    const remaining = entity.buffs?.filter((b) => b !== preview) ?? [];
    entity.buffs = [...remaining, ...hidden] as typeof entity.buffs;
  }
  previewGlowBuffs.clear();
};

export const updatePreviewGlow = (entities: Entity[]) => {
  // Remove glow from entities no longer in preview
  for (const [entity, { preview, hidden }] of previewGlowBuffs) {
    if (!entities.includes(entity)) {
      // Remove preview and restore hidden glows
      const remaining = entity.buffs?.filter((b) => b !== preview) ?? [];
      entity.buffs = [...remaining, ...hidden] as typeof entity.buffs;
      previewGlowBuffs.delete(entity);
    }
  }

  // Add glow to new entities (including already-selected ones for visibility)
  const playerColor = getLocalPlayer()?.playerColor ?? "#ffffff";
  for (const entity of entities) {
    if (!previewGlowBuffs.has(entity)) {
      // Hide existing glow buffs so preview glow takes precedence
      const hidden = entity.buffs?.filter((b) =>
        typeof b === "object" && b !== null && "model" in b &&
        b.model === "glow"
      ) ?? [];

      const preview: PreviewGlowBuff = {
        model: "glow",
        modelScale: (entity.radius ?? 0.25) * 4 / (entity.modelScale ?? 1) +
          0.1,
        modelAlpha: 1.5,
        modelPlayerColor: playerColor,
      };

      // Remove existing glows and add preview
      entity.buffs = [
        ...(entity.buffs?.filter((b) =>
          !hidden.includes(b)
        ) ?? []),
        preview,
      ];
      previewGlowBuffs.set(entity, { preview, hidden });
    }
  }
};

// Calculate which entities would be selected in a rectangle
export const getEntitiesToSelect = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  clickedEntity?: Entity,
): Entity[] => {
  const entitiesInRect = getEntitiesInRect(minX, minY, maxX, maxY);

  // Always include the entity that was clicked on when drag started
  if (clickedEntity && !entitiesInRect.includes(clickedEntity)) {
    entitiesInRect.push(clickedEntity);
  }

  const ownUnits: Entity[] = [];
  const controllableEntities: Entity[] = [];
  const otherEntities: Entity[] = [];
  const localPlayerId = getLocalPlayer()?.id;

  for (const entity of entitiesInRect) {
    if (entity.isDoodad && !editorVar()) continue;
    if (entity.id === "selection-rectangle") continue;
    if (entity.isEffect) continue;
    if ((entity as Entity).hiddenByFog) continue;

    if (entity.owner === localPlayerId) {
      if (isStructure(entity)) controllableEntities.push(entity);
      else ownUnits.push(entity);
    } else if (localPlayerId && hasAllyActions(entity)) {
      controllableEntities.push(entity);
    } else {
      otherEntities.push(entity);
    }
  }

  return ownUnits.length && ownUnits.some((e) => !e.selected)
    ? ownUnits
    : controllableEntities.length &&
        controllableEntities.some((e) => !e.selected)
    ? controllableEntities
    : otherEntities.length && otherEntities.some((e) => !e.selected)
    ? otherEntities
    : ownUnits.length
    ? ownUnits
    : controllableEntities.length
    ? controllableEntities
    : otherEntities;
};

export const addToSelection = () =>
  checkShortcut(shortcutsVar().misc.addToSelectionModifier) > 0;

// State setters
export const setDragStart = (value: { x: number; y: number } | null) => {
  dragStart = value;
};

export const setSelectionEntity = (value: Entity | null) => {
  selectionEntity = value;
};

export const setPendingEntityClick = (
  value: {
    entity: Entity;
    time: number;
    startPixels: { x: number; y: number };
  } | null,
) => {
  pendingEntityClick = value;
};

export const setLastClickedEntity = (value: Entity | null) => {
  lastClickedEntity = value;
};

export const setLastEntityClickTime = (value: number) => {
  lastEntityClickTime = value;
};

// Handle entity selection on mouse up
export const handleEntitySelectionOnMouseUp = (
  pixelsX: number,
  pixelsY: number,
): boolean => {
  if (!pendingEntityClick) return false;

  const { entity: clickedEntity, time, startPixels } = pendingEntityClick;
  pendingEntityClick = null;

  // Check if mouse moved significantly in screen space (would be a drag, not a click)
  const dx = pixelsX - startPixels.x;
  const dy = pixelsY - startPixels.y;
  const distSquared = dx * dx + dy * dy;
  if (distSquared > 5 * 5) return false; // Dragged more than 5 pixels, not a click

  const additive = addToSelection();
  const isDoubleClick = clickedEntity === lastClickedEntity &&
    time - lastEntityClickTime <= DOUBLE_CLICK_THRESHOLD_MS;

  if (isDoubleClick) {
    selectEntitiesByPrefabInRadius(
      clickedEntity,
      DOUBLE_CLICK_SELECTION_RADIUS,
      additive,
      additive,
    );
  } else {
    selectEntity(clickedEntity, !additive, additive);
  }

  lastEntityClickTime = time;
  lastClickedEntity = clickedEntity;

  return true;
};

// Handle drag selection on mouse up
export const handleDragSelectionOnMouseUp = (
  worldX: number,
  worldY: number,
): boolean => {
  if (!selectionEntity || !dragStart) return false;

  // Calculate selection bounds
  const minX = Math.min(dragStart.x, worldX);
  const maxX = Math.max(dragStart.x, worldX);
  const minY = Math.min(dragStart.y, worldY);
  const maxY = Math.max(dragStart.y, worldY);

  const toSelect = getEntitiesToSelect(
    minX,
    minY,
    maxX,
    maxY,
    pendingEntityClick?.entity,
  );

  // Select all units within the rectangle
  if (toSelect.length > 0) {
    const toggle = addToSelection();
    if (!toggle) clearSelection();
    for (const unit of toSelect) selectEntity(unit, false, toggle);
  }

  // Clean up selection rectangle and preview glow
  clearPreviewGlow();
  appContext.current.removeEntity(selectionEntity);
  selectionEntity = null;

  return true;
};

// Update selection rectangle during drag
export const updateSelectionRectangle = (
  currentX: number,
  currentY: number,
): void => {
  if (!dragStart) return;

  const deltaX = Math.abs(currentX - dragStart.x);
  const deltaY = Math.abs(currentY - dragStart.y);

  // Only create rectangle if dragged more than a small threshold
  if (deltaX > 0.01 || deltaY > 0.01 || selectionEntity) {
    if (!selectionEntity) {
      // Create the selection rectangle entity
      selectionEntity = appContext.current.addEntity({
        id: "selection-rectangle",
        model: "square",
        position: { x: 0, y: 0 },
        modelScale: 1,
        aspectRatio: 1,
        alpha: 0.2,
        isDoodad: true,
      });
    }

    // Update position and scale of the selection rectangle
    // Center the rectangle between drag start and current position
    const centerX = (dragStart.x + currentX) / 2;
    const centerY = (dragStart.y + currentY) / 2;

    // Calculate scale based on the drag distance
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    // Update the entity
    selectionEntity.position = { x: centerX, y: centerY };
    // Fallbacks too large
    selectionEntity.modelScale = width || 0.01;
    selectionEntity.aspectRatio = height / (width || 0.01) || 0.01;

    // Update preview glow for entities that would be selected
    const minX = Math.min(dragStart.x, currentX);
    const maxX = Math.max(dragStart.x, currentX);
    const minY = Math.min(dragStart.y, currentY);
    const maxY = Math.max(dragStart.y, currentY);
    const toSelect = getEntitiesToSelect(
      minX,
      minY,
      maxX,
      maxY,
      pendingEntityClick?.entity,
    );
    updatePreviewGlow(toSelect);
  }
};

// Clean up selection state
export const cleanupSelectionState = () => {
  dragStart = null;
  pendingEntityClick = null;
  clearPreviewGlow();
};
