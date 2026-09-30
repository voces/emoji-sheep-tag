import { mouse } from "../mouse.ts";
import { terrain } from "../graphics/three.ts";
import { createBlueprint } from "../controls/blueprintHandlers.ts";
import { getCliffs } from "@/shared/map.ts";
import { tileDefs } from "@/shared/data.ts";
import {
  type EditorActiveAction,
  editorActiveActionVar,
  type EditorTileMode,
  editorTileModeVar,
} from "@/vars/editor.ts";

/** An editor tool that paints or selects terrain through a hidden tile blueprint. */
export type TerrainTool = Exclude<EditorActiveAction, { kind: "doodad" }>;
export type TerrainToolKind = TerrainTool["kind"];
export type CliffToolKind = "raise" | "lower" | "ramp" | "plateau";

/** The tile blueprint's vertex colour for each non-tile terrain tool. */
export const TERRAIN_TOOL_COLORS: Record<
  Exclude<TerrainToolKind, "tile">,
  number
> = {
  raise: 0xff01ff,
  lower: 0xff02ff,
  ramp: 0xff03ff,
  plateau: 0xff04ff,
  select: 0xff05ff,
  paste: 0xff06ff,
  mask: 0xff07ff,
  unmask: 0xff08ff,
  water: 0x385670,
};

export const isCliffTool = (kind: string | undefined): kind is CliffToolKind =>
  kind === "raise" || kind === "lower" || kind === "ramp" ||
  kind === "plateau";

/** The active terrain tool, if a terrain (not doodad) tool is armed. */
export const getTerrainTool = (): TerrainTool | undefined => {
  const action = editorActiveActionVar();
  return action?.kind === "doodad" ? undefined : action;
};

// Paste keeps whatever mode was active; it never paints through the mode
const tileModeFor = (kind: TerrainToolKind): EditorTileMode | undefined =>
  kind === "paste"
    ? undefined
    : kind === "water"
    ? "paintWater"
    : kind === "mask" || kind === "unmask"
    ? "paintMask"
    : "tile";

/** Arms a terrain tool: a hidden tile blueprint follows the cursor and routes clicks. */
export const startTerrainTool = (tool: TerrainTool) => {
  const mode = tileModeFor(tool.kind);
  if (mode) editorTileModeVar(mode);
  const blueprint = createBlueprint("tile", mouse.world.x, mouse.world.y);
  if (!blueprint) return;
  if (tool.kind === "tile") {
    blueprint.vertexColor = tool.color;
    blueprint.pathing = tileDefs.find((t) => t.color === tool.color)?.pathing;
  } else blueprint.vertexColor = TERRAIN_TOOL_COLORS[tool.kind];
  blueprint.isDoodad = true;
  blueprint.alpha = 0;
  editorActiveActionVar(tool);
};

/**
 * The height a raise, lower or plateau stroke anchored at (x, y) levels its
 * cells to; undefined for other tools.
 */
export const getLevelTarget = (
  kind: TerrainToolKind | undefined,
  x: number,
  y: number,
): number | undefined =>
  kind === "raise"
    ? terrain.getCliff(x, y) + 1
    : kind === "lower"
    ? terrain.getCliff(x, y) - 1
    : kind === "plateau"
    ? terrain.getCliff(x, y)
    : undefined;

/**
 * The cliff value a fill or all anchored at (x, y) sets: the level target, or
 * for ramps the start cell's toggled value.
 */
export const getRegionTarget = (
  kind: TerrainToolKind | undefined,
  x: number,
  y: number,
): number | "r" | undefined => {
  if (kind !== "ramp") return getLevelTarget(kind, x, y);
  const cliffs = getCliffs();
  const current = cliffs[cliffs.length - 1 - y]?.[x];
  if (current === undefined) return undefined;
  return current === "r" ? terrain.getCliff(x, y) : "r";
};
