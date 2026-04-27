import { send } from "../messaging.ts";
import { terrain } from "../graphics/three.ts";
import { pathingMap } from "../systems/pathing.ts";
import {
  updatePathingForCliff,
  updatePathingForCliffs,
} from "@/shared/pathing/updatePathingForCliff.ts";
import { getCliffs, getMapBounds, getTiles, getWater } from "@/shared/map.ts";
import { id as generateId } from "@/shared/util/id.ts";

// Command interface - all editor commands must implement execute and undo
export type EditorCommand =
  | CreateEntityCommand
  | DeleteEntityCommand
  | MoveEntitiesCommand
  | SetPathingCommand
  | FillTilesCommand
  | SetCliffCommand
  | BulkSetCliffsCommand
  | SetWaterCommand
  | BulkSetWatersCommand
  | KeyboardMoveCommand
  | BatchCommand;

export type BatchCommand = {
  type: "batch";
  commands: EditorCommand[];
};

export type CreateEntityCommand = {
  type: "createEntity";
  entityId: string;
  entity: Record<string, unknown>;
};

export type DeleteEntityCommand = {
  type: "deleteEntity";
  entityId: string;
  entity: Record<string, unknown>; // Full entity data for restoration
};

export type MoveEntitiesCommand = {
  type: "moveEntities";
  moves: Array<{
    entityId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>;
};

export type SetPathingCommand = {
  type: "setPathing";
  x: number;
  y: number;
  oldPathing: number;
  newPathing: number;
  oldTile: number;
  newTile: number;
};

export type FillTilesCommand = {
  type: "fillTiles";
  cells: Array<[number, number]>;
  oldTile: number;
  newTile: number;
  oldPathing: number;
  newPathing: number;
};

export type SetCliffCommand = {
  type: "setCliff";
  x: number;
  y: number;
  oldCliff: number | "r";
  newCliff: number | "r";
};

export type SetWaterCommand = {
  type: "setWater";
  x: number;
  y: number;
  oldWater: number;
  newWater: number;
};

export type BulkSetCliffsCommand = {
  type: "bulkSetCliffs";
  cells: Array<
    { x: number; y: number; oldCliff: number | "r"; newCliff: number | "r" }
  >;
};

export type BulkSetWatersCommand = {
  type: "bulkSetWaters";
  cells: Array<{ x: number; y: number; oldWater: number; newWater: number }>;
};

export type KeyboardMoveCommand = {
  type: "keyboardMove";
  entityId: string;
  direction: "up" | "down" | "left" | "right";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

// Undo/redo stacks
const undoStack: EditorCommand[] = [];
const redoStack: EditorCommand[] = [];
const MAX_UNDO_HISTORY = 100;

// Subscribers for UI updates
type Listener = () => void;
const listeners: Listener[] = [];

export const subscribeToCommandHistory = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
};

const notifyListeners = () => listeners.forEach((l) => l());

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export const getUndoCount = () => undoStack.length;
export const getRedoCount = () => redoStack.length;

// Helper to update client-side pathing for a cliff change
// x, y are in world coordinates (y=0 is bottom)
const updateClientPathingForCliff = (x: number, y: number) => {
  const tiles = getTiles();
  const cliffs = getCliffs();
  const water = getWater();
  const bounds = getMapBounds();
  updatePathingForCliff(pathingMap, tiles, cliffs, water, x, y, bounds);
};

const updateClientPathingForCells = (
  cells: ReadonlyArray<readonly [number, number]>,
) => {
  if (cells.length === 0) return;
  updatePathingForCliffs(
    pathingMap,
    getTiles(),
    getCliffs(),
    getWater(),
    cells,
    getMapBounds(),
  );
};

// Execute a command and push it to undo stack
export const executeCommand = (command: EditorCommand) => {
  doExecute(command);
  undoStack.push(command);
  if (undoStack.length > MAX_UNDO_HISTORY) undoStack.shift();
  redoStack.length = 0; // Clear redo stack on new command
  notifyListeners();
};

// Add a pre-executed command to the undo stack (for batched drag operations)
export const recordCommand = (command: EditorCommand) => {
  undoStack.push(command);
  if (undoStack.length > MAX_UNDO_HISTORY) undoStack.shift();
  redoStack.length = 0;
  notifyListeners();
};

/**
 * Coalesce a list of per-stroke drag sub-commands into the smallest set of
 * bulk commands. For drags this turns N small bulk ops (each one a full-map
 * pathing recompute on undo) into one bulk per affected mask, so an undo costs
 * the same as a single bulk regardless of stroke count.
 *
 * For each (x, y), keeps the FIRST `old*` (true pre-drag value) and the LAST
 * `new*` (final state). Cells whose final state matches their original are
 * dropped — the net change is zero.
 */
export const mergeDragCommands = (
  commands: EditorCommand[],
): EditorCommand | null => {
  if (commands.length === 0) return null;

  const cliffByKey = new Map<
    number,
    { x: number; y: number; oldCliff: number | "r"; newCliff: number | "r" }
  >();
  const waterByKey = new Map<
    number,
    { x: number; y: number; oldWater: number; newWater: number }
  >();
  const tileByKey = new Map<
    number,
    {
      x: number;
      y: number;
      oldTile: number;
      newTile: number;
      oldPathing: number;
      newPathing: number;
    }
  >();

  let allMergeable = true;

  const key = (x: number, y: number) => y * 100000 + x;

  for (const cmd of commands) {
    if (cmd.type === "bulkSetCliffs") {
      for (const c of cmd.cells) {
        const k = key(c.x, c.y);
        const existing = cliffByKey.get(k);
        if (existing) existing.newCliff = c.newCliff;
        else cliffByKey.set(k, { ...c });
      }
    } else if (cmd.type === "bulkSetWaters") {
      for (const c of cmd.cells) {
        const k = key(c.x, c.y);
        const existing = waterByKey.get(k);
        if (existing) existing.newWater = c.newWater;
        else waterByKey.set(k, { ...c });
      }
    } else if (cmd.type === "fillTiles") {
      for (const [x, y] of cmd.cells) {
        const k = key(x, y);
        const existing = tileByKey.get(k);
        if (existing) {
          existing.newTile = cmd.newTile;
          existing.newPathing = cmd.newPathing;
        } else {
          tileByKey.set(k, {
            x,
            y,
            oldTile: cmd.oldTile,
            newTile: cmd.newTile,
            oldPathing: cmd.oldPathing,
            newPathing: cmd.newPathing,
          });
        }
      }
    } else {
      allMergeable = false;
      break;
    }
  }

  if (!allMergeable) {
    return commands.length === 1 ? commands[0] : batchCommand(commands);
  }

  const out: EditorCommand[] = [];

  if (cliffByKey.size > 0) {
    const cells = [...cliffByKey.values()].filter((c) =>
      c.oldCliff !== c.newCliff
    );
    if (cells.length) out.push({ type: "bulkSetCliffs", cells });
  }

  if (waterByKey.size > 0) {
    const cells = [...waterByKey.values()].filter((c) =>
      c.oldWater !== c.newWater
    );
    if (cells.length) out.push({ type: "bulkSetWaters", cells });
  }

  if (tileByKey.size > 0) {
    // Re-group by (oldTile, newTile, oldPathing, newPathing) so each
    // fillTilesCommand keeps its single-pair undo invariant.
    const groups = new Map<string, [number, number][]>();
    const meta = new Map<
      string,
      {
        oldTile: number;
        newTile: number;
        oldPathing: number;
        newPathing: number;
      }
    >();
    for (const c of tileByKey.values()) {
      if (c.oldTile === c.newTile) continue;
      const gk = `${c.oldTile}|${c.newTile}|${c.oldPathing}|${c.newPathing}`;
      let list = groups.get(gk);
      if (!list) {
        list = [];
        groups.set(gk, list);
        meta.set(gk, c);
      }
      list.push([c.x, c.y]);
    }
    for (const [gk, cells] of groups) {
      const m = meta.get(gk)!;
      out.push({
        type: "fillTiles",
        cells,
        oldTile: m.oldTile,
        newTile: m.newTile,
        oldPathing: m.oldPathing,
        newPathing: m.newPathing,
      });
    }
  }

  if (out.length === 0) return null;
  return out.length === 1 ? out[0] : batchCommand(out);
};

// Actually perform the command (no stack manipulation)
export const doExecute = (command: EditorCommand) => {
  switch (command.type) {
    case "createEntity":
      send({
        type: "editorCreateEntity",
        entity: command.entity,
      });
      break;

    case "deleteEntity":
      send({
        type: "unitOrder",
        units: [command.entityId],
        order: "editorRemoveEntity",
      });
      break;

    case "moveEntities":
      send({
        type: "editorUpdateEntities",
        entities: command.moves.map((m) => ({
          id: m.entityId,
          position: { x: m.toX, y: m.toY },
        })),
      });
      break;

    case "setPathing": {
      terrain.setGroundTile(command.x, command.y, command.newTile);
      pathingMap.setPathing(command.x, command.y, command.newPathing);
      send({
        type: "editorSetPathing",
        x: command.x,
        y: command.y,
        pathing: command.newPathing,
        tile: command.newTile,
      });
      break;
    }

    case "fillTiles": {
      terrain.setGroundTiles(
        command.cells.map(([x, y]) => [x, y, command.newTile]),
      );
      for (const [x, y] of command.cells) {
        pathingMap.setPathing(x, y, command.newPathing);
      }
      send({
        type: "editorBulkSetTiles",
        cells: command.cells,
        tile: command.newTile,
        pathing: command.newPathing,
      });
      break;
    }

    case "setCliff": {
      terrain.setCliff(command.x, command.y, command.newCliff);
      const cliffs = getCliffs();
      cliffs[cliffs.length - 1 - command.y][command.x] =
        terrain.masks.cliff[command.y][command.x];
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetCliff",
        x: command.x,
        y: command.y,
        cliff: command.newCliff,
      });
      break;
    }

    case "setWater": {
      terrain.setWater(command.x, command.y, command.newWater);
      const water = getWater();
      water[water.length - 1 - command.y][command.x] = command.newWater;
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetWater",
        x: command.x,
        y: command.y,
        water: command.newWater,
      });
      break;
    }

    case "bulkSetCliffs": {
      terrain.setCliffs(
        command.cells.map(({ x, y, newCliff }) => [x, y, newCliff]),
      );
      const cliffs = getCliffs();
      for (const { x, y } of command.cells) {
        cliffs[cliffs.length - 1 - y][x] = terrain.masks.cliff[y][x];
      }
      updateClientPathingForCells(
        command.cells.map(({ x, y }) => [x, y] as const),
      );
      send({
        type: "editorBulkSetCliffs",
        cells: command.cells.map(({ x, y, newCliff }) => ({
          x,
          y,
          cliff: newCliff,
        })),
      });
      break;
    }

    case "bulkSetWaters": {
      terrain.setWaters(
        command.cells.map(({ x, y, newWater }) => [x, y, newWater]),
      );
      const water = getWater();
      for (const { x, y, newWater } of command.cells) {
        const row = water[water.length - 1 - y];
        if (row?.[x] !== undefined) row[x] = newWater;
      }
      updateClientPathingForCells(
        command.cells.map(({ x, y }) => [x, y] as const),
      );
      send({
        type: "editorBulkSetWaters",
        cells: command.cells.map(({ x, y, newWater }) => ({
          x,
          y,
          water: newWater,
        })),
      });
      break;
    }

    case "keyboardMove":
      send({
        type: "editorUpdateEntities",
        entities: [{
          id: command.entityId,
          position: { x: command.toX, y: command.toY },
        }],
      });
      break;

    case "batch":
      for (const cmd of command.commands) {
        doExecute(cmd);
      }
      break;
  }
};

// Undo a command
const doUndo = (command: EditorCommand) => {
  switch (command.type) {
    case "createEntity":
      // Delete the created entity
      send({
        type: "unitOrder",
        units: [command.entityId],
        order: "editorRemoveEntity",
      });
      break;

    case "deleteEntity":
      // Recreate the deleted entity
      send({
        type: "editorCreateEntity",
        entity: { ...command.entity, id: command.entityId },
      });
      break;

    case "moveEntities":
      // Move entities back to original positions
      send({
        type: "editorUpdateEntities",
        entities: command.moves.map((m) => ({
          id: m.entityId,
          position: { x: m.fromX, y: m.fromY },
        })),
      });
      break;

    case "setPathing": {
      terrain.setGroundTile(command.x, command.y, command.oldTile);
      pathingMap.setPathing(command.x, command.y, command.oldPathing);
      send({
        type: "editorSetPathing",
        x: command.x,
        y: command.y,
        pathing: command.oldPathing,
        tile: command.oldTile,
      });
      break;
    }

    case "fillTiles": {
      terrain.setGroundTiles(
        command.cells.map(([x, y]) => [x, y, command.oldTile]),
      );
      for (const [x, y] of command.cells) {
        pathingMap.setPathing(x, y, command.oldPathing);
      }
      send({
        type: "editorBulkSetTiles",
        cells: command.cells,
        tile: command.oldTile,
        pathing: command.oldPathing,
      });
      break;
    }

    case "setCliff": {
      terrain.setCliff(command.x, command.y, command.oldCliff);
      const cliffs = getCliffs();
      cliffs[cliffs.length - 1 - command.y][command.x] =
        terrain.masks.cliff[command.y][command.x];
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetCliff",
        x: command.x,
        y: command.y,
        cliff: command.oldCliff,
      });
      break;
    }

    case "setWater": {
      terrain.setWater(command.x, command.y, command.oldWater);
      const water = getWater();
      water[water.length - 1 - command.y][command.x] = command.oldWater;
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetWater",
        x: command.x,
        y: command.y,
        water: command.oldWater,
      });
      break;
    }

    case "bulkSetCliffs": {
      terrain.setCliffs(
        command.cells.map(({ x, y, oldCliff }) => [x, y, oldCliff]),
      );
      const cliffs = getCliffs();
      for (const { x, y } of command.cells) {
        cliffs[cliffs.length - 1 - y][x] = terrain.masks.cliff[y][x];
      }
      updateClientPathingForCells(
        command.cells.map(({ x, y }) => [x, y] as const),
      );
      send({
        type: "editorBulkSetCliffs",
        cells: command.cells.map(({ x, y, oldCliff }) => ({
          x,
          y,
          cliff: oldCliff,
        })),
      });
      break;
    }

    case "bulkSetWaters": {
      terrain.setWaters(
        command.cells.map(({ x, y, oldWater }) => [x, y, oldWater]),
      );
      const water = getWater();
      for (const { x, y, oldWater } of command.cells) {
        const row = water[water.length - 1 - y];
        if (row?.[x] !== undefined) row[x] = oldWater;
      }
      updateClientPathingForCells(
        command.cells.map(({ x, y }) => [x, y] as const),
      );
      send({
        type: "editorBulkSetWaters",
        cells: command.cells.map(({ x, y, oldWater }) => ({
          x,
          y,
          water: oldWater,
        })),
      });
      break;
    }

    case "keyboardMove":
      send({
        type: "editorUpdateEntities",
        entities: [{
          id: command.entityId,
          position: { x: command.fromX, y: command.fromY },
        }],
      });
      break;

    case "batch":
      // Undo in reverse order
      for (let i = command.commands.length - 1; i >= 0; i--) {
        doUndo(command.commands[i]);
      }
      break;
  }
};

export const undo = () => {
  const command = undoStack.pop();
  if (!command) return;
  doUndo(command);
  redoStack.push(command);
  notifyListeners();
};

/**
 * Undo only the most recent sub-step of the top command. If the top is a
 * batch, pop and undo its last sub-command and leave the rest of the batch in
 * place (so subsequent step-undos peel off one sub-step at a time). For
 * non-batch commands this is identical to undo().
 */
export const undoLastStep = () => {
  const top = undoStack[undoStack.length - 1];
  if (!top) return;
  if (top.type !== "batch" || top.commands.length === 0) {
    undo();
    return;
  }
  const sub = top.commands.pop()!;
  doUndo(sub);
  if (top.commands.length === 0) undoStack.pop();
  // Step-undo discards the popped sub-step from redo history (no per-step
  // redo). This matches typical "fine grained undo" expectations.
  redoStack.length = 0;
  notifyListeners();
};

export const redo = () => {
  const command = redoStack.pop();
  if (!command) return;
  doExecute(command);
  undoStack.push(command);
  notifyListeners();
};

// Clear history (e.g., when switching maps or leaving editor)
export const clearCommandHistory = () => {
  undoStack.length = 0;
  redoStack.length = 0;
  notifyListeners();
};

// Helper functions to create commands with proper data

export const createEntityCommand = (
  entity: Record<string, unknown>,
  prefab?: string,
): CreateEntityCommand => {
  const entityId = generateId(prefab);
  return {
    type: "createEntity",
    entityId,
    entity: { ...entity, id: entityId },
  };
};

export const moveEntitiesCommand = (
  moves: Array<{
    entityId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>,
): MoveEntitiesCommand => ({
  type: "moveEntities",
  moves,
});

export const setPathingCommand = (
  x: number,
  y: number,
  oldPathing: number,
  newPathing: number,
  oldTile: number,
  newTile: number,
): SetPathingCommand => ({
  type: "setPathing",
  x,
  y,
  oldPathing,
  newPathing,
  oldTile,
  newTile,
});

export const fillTilesCommand = (
  cells: Array<[number, number]>,
  oldTile: number,
  newTile: number,
  oldPathing: number,
  newPathing: number,
): FillTilesCommand => ({
  type: "fillTiles",
  cells,
  oldTile,
  newTile,
  oldPathing,
  newPathing,
});

export const setCliffCommand = (
  x: number,
  y: number,
  oldCliff: number | "r",
  newCliff: number | "r",
): SetCliffCommand => ({
  type: "setCliff",
  x,
  y,
  oldCliff,
  newCliff,
});

export const setWaterCommand = (
  x: number,
  y: number,
  oldWater: number,
  newWater: number,
): SetWaterCommand => ({
  type: "setWater",
  x,
  y,
  oldWater,
  newWater,
});

export const bulkSetCliffsCommand = (
  cells: BulkSetCliffsCommand["cells"],
): BulkSetCliffsCommand => ({
  type: "bulkSetCliffs",
  cells,
});

export const bulkSetWatersCommand = (
  cells: BulkSetWatersCommand["cells"],
): BulkSetWatersCommand => ({
  type: "bulkSetWaters",
  cells,
});

export const deleteEntityCommand = (
  entityId: string,
  entity: Record<string, unknown>,
): DeleteEntityCommand => ({
  type: "deleteEntity",
  entityId,
  entity,
});

export const keyboardMoveCommand = (
  entityId: string,
  direction: "up" | "down" | "left" | "right",
  fromX: number,
  fromY: number,
): KeyboardMoveCommand => {
  const delta = 0.5;
  const toX = direction === "left"
    ? fromX - delta
    : direction === "right"
    ? fromX + delta
    : fromX;
  const toY = direction === "down"
    ? fromY - delta
    : direction === "up"
    ? fromY + delta
    : fromY;
  return {
    type: "keyboardMove",
    entityId,
    direction,
    fromX,
    fromY,
    toX,
    toY,
  };
};

export const batchCommand = (commands: EditorCommand[]): BatchCommand => ({
  type: "batch",
  commands,
});
