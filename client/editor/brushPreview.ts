import { mouse } from "../mouse.ts";
import { scene } from "../graphics/three.ts";
import { getBlueprint } from "../controls/blueprintHandlers.ts";
import { BrushPreview } from "../graphics/BrushPreview.ts";
import { type Cell } from "./brush.ts";
import {
  editorActiveActionVar,
  editorBrushShapeVar,
  editorBrushSizeVar,
  editorTerrainSelectionVar,
  editorTileModeVar,
  editorVar,
} from "@/vars/editor.ts";
import { clipCellsToSelection } from "./selection.ts";
import { getMap } from "@/shared/map.ts";
import {
  fillsByCliff,
  getMaskAnchor,
  getMaskCells,
  getTileCells,
  getTileFillValue,
  getTileGridSize,
  isInMaskGrid,
} from "./terrainCells.ts";
import {
  getTerrainTool,
  isCliffTool,
  TERRAIN_TOOL_COLORS,
  type TerrainTool,
} from "./terrainTools.ts";

const CLIFF_FILL_COLOR = 0xffffff;

let preview: BrushPreview | undefined;
// The cell set the preview is currently showing, plus the inputs that produced
// it. When the next refresh's inputs match, we can skip the (expensive) cell
// recompute + geometry rebuild and just slide the center crosshair.
let cachedKey = "";
let cachedCellSet: Set<number> | null = null;
let cachedCenter = "";

const cellId = (x: number, y: number) => y * 100000 + x;

const resetPreview = () => {
  cachedKey = "";
  cachedCellSet = null;
  cachedCenter = "";
  preview?.hide();
};

const moveCenter = (x: number, y: number) => {
  if (!preview) return;
  const centerKey = `${x}|${y}`;
  if (centerKey !== cachedCenter) {
    preview.setCenter([x, y]);
    cachedCenter = centerKey;
  }
  preview.visible = true;
};

/**
 * Whether the cached cells still apply for `key`. A fill's cells depend on
 * which region the cursor is in, not just the source value in the key, so it
 * also needs the cursor cell inside the cached set.
 */
const isCached = (key: string, fill: boolean, x: number, y: number) =>
  key === cachedKey && (!fill || !!cachedCellSet?.has(cellId(x, y)));

const showCells = (
  key: string,
  cellsForSet: Cell[],
  cells: Cell[],
  color: number,
) => {
  preview?.setArea(cells, color);
  cachedKey = key;
  cachedCellSet = new Set(cellsForSet.map(([x, y]) => cellId(x, y)));
};

const getFillColor = (
  mode: ReturnType<typeof editorTileModeVar>,
  tool: TerrainTool | undefined,
): number => {
  if (mode === "paintWater") return TERRAIN_TOOL_COLORS.water;
  if (!tool || isCliffTool(tool.kind)) return CLIFF_FILL_COLOR;
  if (tool.kind === "tile") return tool.color;
  return TERRAIN_TOOL_COLORS[tool.kind];
};

const selectionKey = (): string => {
  const sel = editorTerrainSelectionVar();
  return sel ? `${sel.minX},${sel.minY},${sel.maxX},${sel.maxY}` : "none";
};

// Mask paint: cells live on cliff vertices, anchored to the bounds. Compute
// the brush in mask-grid space and translate into BrushPreview's cell-quad
// space (which draws unit squares from [x,y] to [x+1,y+1]). A mask cell at
// world vertex (vx, vy) covers world (vx-0.5, vy-0.5) → (vx+0.5, vy+0.5),
// so we pass [vx-0.5, vy-0.5] as the quad anchor.
const refreshMask = (kind: "mask" | "unmask") => {
  // blueprint.position is normalized to the nearest tile cell center
  // (so e.g. 2.3 and 2.7 both snap to 2.5), which loses the vertex
  // information we need. Use the raw mouse world position — the same
  // input the click handler uses — to find the nearest vertex.
  const anchor = getMaskAnchor(mouse.world.x, mouse.world.y);
  const { shape, x, y, vx, vy } = anchor;
  if (shape.width === 0 || shape.height === 0) return resetPreview();

  const size = editorBrushSizeVar();
  const brushShape = editorBrushShapeVar();
  if (size === "fill" && !isInMaskGrid(anchor)) return resetPreview();

  // Sized brushes move with the cursor; "all" and a fill (while the cursor
  // stays inside its region) do not
  const key = size === "all"
    ? `mask|${kind}|all`
    : size === "fill"
    ? `mask-fill|${kind}|${getMap().mask[y]?.[x] ?? 0}`
    : `mask|${kind}|${size}|${brushShape}|${x}|${y}`;

  if (!isCached(key, size === "fill", x, y)) {
    const mapCells = getMaskCells(size, brushShape, anchor);
    showCells(
      key,
      mapCells,
      mapCells.map(([mx, my]) => [
        shape.firstVertexX + mx - 0.5,
        shape.topVertexY - my - 0.5,
      ]),
      kind === "mask" ? 0x000000 : 0xffffff,
    );
  }
  moveCenter(vx - 0.5, vy - 0.5);
};

const refresh = () => {
  if (!preview) return;
  if (!editorVar()) return resetPreview();
  const blueprint = getBlueprint();
  if (
    !blueprint || blueprint.prefab !== "tile" || blueprint.owner ||
    !blueprint.position
  ) return resetPreview();

  // Paste tool has its own clipboard stamp visual — don't paint over it.
  // Select tool: hide while a selection already exists (the rectangle is the
  // visual); otherwise fall through and render a 1x1 hover marker so the user
  // can see where their click will start.
  const tool = getTerrainTool();
  const activeKind = tool?.kind;
  if (
    activeKind === "paste" ||
    (activeKind === "select" && editorTerrainSelectionVar())
  ) return resetPreview();

  if (activeKind === "mask" || activeKind === "unmask") {
    return refreshMask(activeKind);
  }

  const cx = Math.round(blueprint.position.x - 0.5);
  const cy = Math.round(blueprint.position.y - 0.5);
  const { width, height } = getTileGridSize();
  if (
    width === 0 || height === 0 || cx < 0 || cx >= width || cy < 0 ||
    cy >= height
  ) return resetPreview();

  const mode = editorTileModeVar();
  const byCliff = fillsByCliff(mode, activeKind);
  // The select tool only ever marks a single cell at a time — ignore the
  // user's painting brush size so the preview matches what a click does.
  const size = activeKind === "select" ? 1 : editorBrushSizeVar();
  const shape = editorBrushShapeVar();
  const toolKey = `${mode}|${
    activeKind === "tile" ? tool?.color : activeKind
  }|${selectionKey()}`;

  const key = size === "all"
    ? `all|${width}|${height}|${toolKey}`
    : size === "fill"
    ? `fill|${toolKey}|${getTileFillValue(byCliff, cx, cy)}`
    : `brush|${size}|${shape}|${cx}|${cy}|${toolKey}`;

  if (!isCached(key, size === "fill", cx, cy)) {
    // Clip the previewed cells to the active terrain selection so the brush
    // overlay matches what the click would actually paint.
    const cells = clipCellsToSelection(
      getTileCells(size, shape, cx, cy, byCliff),
    ) as Cell[];
    showCells(key, cells, cells, getFillColor(mode, tool));
  }
  moveCenter(cx, cy);
};

// Listeners that only matter while the editor is active. We attach/detach them
// on the editor toggle so non-editor sessions pay nothing for the brush
// preview (no mouseMove handler registered, no var subscriptions firing).
let mouseMoveAttached = false;
let editorScopedSubscriptions: Array<() => void> = [];

const attachEditorListeners = () => {
  if (mouseMoveAttached) return;
  mouseMoveAttached = true;
  mouse.addEventListener("mouseMove", refresh);
  editorScopedSubscriptions = [
    editorBrushSizeVar.subscribe(refresh),
    editorBrushShapeVar.subscribe(refresh),
    editorTileModeVar.subscribe(refresh),
    editorActiveActionVar.subscribe(refresh),
    editorTerrainSelectionVar.subscribe(refresh),
  ];
};

const detachEditorListeners = () => {
  if (!mouseMoveAttached) return;
  mouseMoveAttached = false;
  mouse.removeEventListener("mouseMove", refresh);
  for (const unsubscribe of editorScopedSubscriptions) unsubscribe();
  editorScopedSubscriptions = [];
};

const init = () => {
  if (preview || "Deno" in globalThis) return;
  preview = new BrushPreview();
  scene.add(preview);

  if (editorVar()) attachEditorListeners();
  editorVar.subscribe((active) => {
    if (active) attachEditorListeners();
    else {
      detachEditorListeners();
      resetPreview();
    }
  });
};

init();
