import { app, Entity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";
import { mouse } from "../mouse.ts";
import { normalizeBuildPosition } from "../controls/blueprintHandlers.ts";
import { prefabs } from "@/shared/data.ts";
import {
  batchCommand,
  createEntityCommand,
  deleteEntityCommand,
  type EditorCommand,
  executeCommand,
} from "./commands.ts";

// Properties to preserve when copying doodads
const DOODAD_PROPERTIES = [
  "prefab",
  "position",
  "facing",
  "modelScale",
  "playerColor",
  "vertexColor",
  "model",
  "isDoodad",
  "radius",
  "type",
] as const;

type ClipboardData = {
  type: "emoji-sheep-tag-doodads";
  entities: Array<Record<string, unknown>>;
  center: { x: number; y: number };
  anchorPrefab: string | null;
};

let pasteBlueprints: Entity[] = [];
let pasteData: ClipboardData | null = null;
let isCutOperation = false;
let cutSourceIds: string[] = [];

const serializeEntity = (entity: Entity): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  for (const prop of DOODAD_PROPERTIES) {
    if (entity[prop] !== undefined) {
      data[prop] = entity[prop];
    }
  }
  return data;
};

const calculateCenter = (entities: Entity[]): { x: number; y: number } => {
  if (entities.length === 0) return { x: 0, y: 0 };
  const sum = entities.reduce(
    (acc, e) => ({
      x: acc.x + (e.position?.x ?? 0),
      y: acc.y + (e.position?.y ?? 0),
    }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / entities.length, y: sum.y / entities.length };
};

// Find the entity with the largest tilemap (for snapping purposes)
const findAnchorPrefab = (entities: Entity[]): string | null => {
  let largestTilemap = 0;
  let anchorPrefab: string | null = null;

  for (const entity of entities) {
    if (!entity.prefab) continue;
    const prefabData = prefabs[entity.prefab];
    if (!prefabData?.tilemap) continue;

    const size = (prefabData.tilemap.width ?? 0) *
      (prefabData.tilemap.height ?? 0);
    if (size > largestTilemap) {
      largestTilemap = size;
      anchorPrefab = entity.prefab;
    }
  }

  return anchorPrefab;
};

export const copySelectedDoodads = async (cut = false): Promise<boolean> => {
  const selected = Array.from(selection).filter((e) => e.isDoodad && !e.owner);
  if (selected.length === 0) return false;

  const center = calculateCenter(selected);
  const anchorPrefab = findAnchorPrefab(selected);

  const clipboardData: ClipboardData = {
    type: "emoji-sheep-tag-doodads",
    entities: selected.map((e) => {
      const data = serializeEntity(e);
      // Store positions relative to center
      if (e.position) {
        data.position = {
          x: e.position.x - center.x,
          y: e.position.y - center.y,
        };
      }
      return data;
    }),
    center,
    anchorPrefab,
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(clipboardData));
    isCutOperation = cut;
    cutSourceIds = cut ? selected.map((e) => e.id) : [];
    return true;
  } catch {
    return false;
  }
};

export const startPaste = async (): Promise<boolean> => {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text) as ClipboardData;

    if (
      data.type !== "emoji-sheep-tag-doodads" || !Array.isArray(data.entities)
    ) {
      return false;
    }

    pasteData = data;
    createPasteBlueprints(mouse.world.x, mouse.world.y);
    return true;
  } catch {
    return false;
  }
};

// Calculate snapped center position based on anchor prefab
const getSnappedCenter = (
  centerX: number,
  centerY: number,
  anchorPrefab: string | null,
): [number, number] => {
  if (!anchorPrefab) return [centerX, centerY];
  const [x, y] = normalizeBuildPosition(centerX, centerY, anchorPrefab);
  return [x, y];
};

const createPasteBlueprints = (centerX: number, centerY: number) => {
  clearPasteBlueprints();

  if (!pasteData) return;

  const [snappedCenterX, snappedCenterY] = getSnappedCenter(
    centerX,
    centerY,
    pasteData.anchorPrefab,
  );

  for (const entityData of pasteData.entities) {
    const relPos = entityData.position as { x: number; y: number } | undefined;

    const blueprint = app.addEntity({
      ...entityData,
      id: `paste-blueprint-${pasteBlueprints.length}`,
      position: {
        x: snappedCenterX + (relPos?.x ?? 0),
        y: snappedCenterY + (relPos?.y ?? 0),
      },
      alpha: 0.75,
      vertexColor: 0x00ff00,
    });

    pasteBlueprints.push(blueprint);
  }
};

export const updatePasteBlueprints = (centerX: number, centerY: number) => {
  if (!pasteData || pasteBlueprints.length === 0) return;

  const [snappedCenterX, snappedCenterY] = getSnappedCenter(
    centerX,
    centerY,
    pasteData.anchorPrefab,
  );

  for (let i = 0; i < pasteBlueprints.length; i++) {
    const blueprint = pasteBlueprints[i];
    const entityData = pasteData.entities[i];
    const relPos = entityData.position as { x: number; y: number } | undefined;

    blueprint.position = {
      x: snappedCenterX + (relPos?.x ?? 0),
      y: snappedCenterY + (relPos?.y ?? 0),
    };
  }
};

export const confirmPaste = () => {
  if (!pasteData || pasteBlueprints.length === 0) return;

  const commands: EditorCommand[] = [];

  // If this was a cut operation, delete the source entities first
  if (isCutOperation && cutSourceIds.length > 0) {
    for (const id of cutSourceIds) {
      const entity = Array.from(app.entities).find((e) => e.id === id);
      if (entity) {
        // Only include safe properties for delete command
        const entityData = serializeEntity(entity);
        commands.push(deleteEntityCommand(id, entityData));
      }
    }
    isCutOperation = false;
    cutSourceIds = [];
  }

  // Create the pasted entities
  for (let i = 0; i < pasteBlueprints.length; i++) {
    const blueprint = pasteBlueprints[i];
    const originalData = pasteData.entities[i];

    // Build clean entity data from blueprint position + original properties
    const entityData: Record<string, unknown> = {
      ...originalData,
      position: blueprint.position,
    };

    // Restore original vertex color if it was stored
    if (typeof originalData.vertexColor === "number") {
      entityData.vertexColor = originalData.vertexColor;
    } else {
      delete entityData.vertexColor;
    }

    commands.push(
      createEntityCommand(entityData, entityData.prefab as string),
    );
  }

  // Execute as a single batch command for unified undo/redo
  if (commands.length > 0) {
    executeCommand(
      commands.length === 1 ? commands[0] : batchCommand(commands),
    );
  }

  clearPasteBlueprints();
  pasteData = null;
};

export const clearPasteBlueprints = () => {
  for (const blueprint of pasteBlueprints) {
    app.removeEntity(blueprint);
  }
  pasteBlueprints = [];
};

export const cancelPaste = () => {
  clearPasteBlueprints();
  pasteData = null;
  isCutOperation = false;
  cutSourceIds = [];
};

export const isPasting = () => pasteBlueprints.length > 0;
