import { mouse } from "../mouse.ts";
import { scene, terrain } from "../graphics/three.ts";
import { getBlueprint } from "../controls/blueprintHandlers.ts";
import { BrushPreview } from "../graphics/BrushPreview.ts";
import {
  type Cell,
  getAllCells,
  getBrushCells,
  getFloodFillCells,
} from "./brush.ts";
import {
  editorActiveActionVar,
  editorBrushShapeVar,
  editorBrushSizeVar,
  editorTerrainSelectionVar,
  editorTileModeVar,
  editorVar,
} from "@/vars/editor.ts";
import { clipCellsToSelection } from "./selection.ts";
import { getMap, getMaskShapeForBounds } from "@/shared/map.ts";

const CLIFF_SENTINELS = new Set([0xff01ff, 0xff02ff, 0xff03ff, 0xff04ff]);
const WATER_FILL_COLOR = 0x385670;
const CLIFF_FILL_COLOR = 0xffffff;

let preview: BrushPreview | undefined;
// The cell set the preview is currently showing, plus the inputs that produced
// it. When the next refresh's inputs match, we can skip the (expensive) cell
// recompute + geometry rebuild and just slide the center crosshair.
let cachedKey = "";
let cachedCellSet: Set<number> | null = null;
let cachedCenter = "";

const getMaskDimensions = () => {
  const grid = terrain.masks.groundTile;
  return { width: grid[0]?.length ?? 0, height: grid.length };
};

const isCliffMode = (
  mode: ReturnType<typeof editorTileModeVar>,
  vc: number | null | undefined,
) =>
  mode === "paintWater" || (typeof vc === "number" && CLIFF_SENTINELS.has(vc));

const getFillColor = (
  mode: ReturnType<typeof editorTileModeVar>,
  vc: number | null | undefined,
): number => {
  if (mode === "paintWater") return WATER_FILL_COLOR;
  if (typeof vc === "number" && CLIFF_SENTINELS.has(vc)) {
    return CLIFF_FILL_COLOR;
  }
  if (typeof vc === "number") return vc;
  return CLIFF_FILL_COLOR;
};

const getSourceValue = (
  mode: ReturnType<typeof editorTileModeVar>,
  vc: number | null | undefined,
  cx: number,
  cy: number,
): number => {
  if (isCliffMode(mode, vc)) return terrain.getCliff(cx, cy);
  return terrain.masks.groundTile[cy]?.[cx] ?? -1;
};

const selectionKey = (): string => {
  const sel = editorTerrainSelectionVar();
  return sel ? `${sel.minX},${sel.minY},${sel.maxX},${sel.maxY}` : "none";
};

const computeCells = (
  mode: ReturnType<typeof editorTileModeVar>,
  vc: number | null | undefined,
  cx: number,
  cy: number,
): { cells: Cell[]; key: string } | undefined => {
  const { width, height } = getMaskDimensions();
  if (width === 0 || height === 0) return undefined;
  if (cx < 0 || cx >= width || cy < 0 || cy >= height) return undefined;

  // The select tool only ever marks a single cell at a time — ignore the
  // user's painting brush size so the preview matches what a click does.
  const action = editorActiveActionVar()?.kind;
  const size = action === "select" ? 1 : editorBrushSizeVar();
  const shape = editorBrushShapeVar();
  const selKey = selectionKey();

  let baseCells: Cell[];
  let key: string;
  if (size === "all") {
    baseCells = getAllCells(width, height);
    key = `all|${width}|${height}|${mode}|${vc}|${selKey}`;
  } else if (size === "fill") {
    const sourceValue = getSourceValue(mode, vc, cx, cy);
    const cliffMode = isCliffMode(mode, vc);
    const getValue = cliffMode
      ? (x: number, y: number) => terrain.getCliff(x, y)
      : (x: number, y: number) => terrain.masks.groundTile[y][x];
    baseCells = getFloodFillCells(cx, cy, width, height, getValue);
    key = `fill|${mode}|${vc}|${sourceValue}|${selKey}`;
  } else {
    baseCells = getBrushCells(cx, cy, size, shape, width, height);
    key = `brush|${size}|${shape}|${cx}|${cy}|${mode}|${vc}|${selKey}|${
      action ?? ""
    }`;
  }

  // Clip the previewed cells to the active terrain selection so the brush
  // overlay matches what the click would actually paint.
  const cells = clipCellsToSelection(baseCells) as Cell[];
  return { cells, key };
};

const refresh = () => {
  if (!preview) return;
  if (!editorVar()) {
    cachedKey = "";
    cachedCellSet = null;
    cachedCenter = "";
    return preview.hide();
  }
  const blueprint = getBlueprint();
  if (
    !blueprint || blueprint.prefab !== "tile" || blueprint.owner ||
    !blueprint.position
  ) {
    cachedKey = "";
    cachedCellSet = null;
    cachedCenter = "";
    return preview.hide();
  }

  // Paste tool has its own clipboard stamp visual — don't paint over it.
  // Select tool: hide while a selection already exists (the rectangle is the
  // visual); otherwise let computeCells fall through and render a 1x1 hover
  // marker so the user can see where their click will start.
  const activeKind = editorActiveActionVar()?.kind;
  if (
    activeKind === "paste" ||
    (activeKind === "select" && editorTerrainSelectionVar())
  ) {
    cachedKey = "";
    cachedCellSet = null;
    cachedCenter = "";
    return preview.hide();
  }
  // Mask paint: cells live on cliff vertices, anchored to the bounds. Compute
  // the brush in mask-grid space and translate into BrushPreview's cell-quad
  // space (which draws unit squares from [x,y] to [x+1,y+1]). A mask cell at
  // world vertex (vx, vy) covers world (vx-0.5, vy-0.5) → (vx+0.5, vy+0.5),
  // so we pass [vx-0.5, vy-0.5] as the quad anchor.
  if (activeKind === "mask" || activeKind === "unmask") {
    const map = getMap();
    const blueprint = getBlueprint();
    if (
      !blueprint || blueprint.prefab !== "tile" || blueprint.owner ||
      !blueprint.position
    ) {
      cachedKey = "";
      cachedCellSet = null;
      cachedCenter = "";
      return preview.hide();
    }
    const shape = getMaskShapeForBounds(map.bounds);
    if (shape.width === 0 || shape.height === 0) {
      cachedKey = "";
      cachedCellSet = null;
      cachedCenter = "";
      return preview.hide();
    }
    // blueprint.position is normalized to the nearest tile cell center
    // (so e.g. 2.3 and 2.7 both snap to 2.5), which loses the vertex
    // information we need. Use the raw mouse world position — the same
    // input the click handler uses — to find the nearest vertex.
    const vx = Math.round(mouse.world.x);
    const vy = Math.round(mouse.world.y);
    const centerMapX = vx - shape.firstVertexX;
    const centerMapY = shape.topVertexY - vy;
    const size = editorBrushSizeVar();
    const shapeKey = editorBrushShapeVar();
    let mapCells: Cell[];
    if (size === "all") {
      mapCells = getAllCells(shape.width, shape.height);
    } else if (size === "fill") {
      if (
        centerMapX < 0 || centerMapX >= shape.width ||
        centerMapY < 0 || centerMapY >= shape.height
      ) {
        cachedKey = "";
        cachedCellSet = null;
        cachedCenter = "";
        return preview.hide();
      }
      const value = map.mask[centerMapY]?.[centerMapX] ?? 0;
      mapCells = getFloodFillCells(
        centerMapX,
        centerMapY,
        shape.width,
        shape.height,
        (x, y) => map.mask[y]?.[x] ?? 0,
      );
      // Cache key includes the source value so moving inside the same flood
      // region doesn't rebuild the geometry.
      const newKey = `mask-fill|${centerMapX}|${centerMapY}|${value}`;
      if (newKey === cachedKey) {
        // Just refresh the center crosshair.
        const centerKey = `${vx - 0.5}|${vy - 0.5}`;
        if (centerKey !== cachedCenter) {
          preview.setCenter([vx - 0.5, vy - 0.5]);
          cachedCenter = centerKey;
        }
        preview.visible = true;
        return;
      }
      cachedKey = newKey;
    } else {
      const brushSize = typeof size === "number" ? size : 1;
      mapCells = getBrushCells(
        centerMapX,
        centerMapY,
        brushSize,
        shapeKey,
        shape.width,
        shape.height,
      );
    }

    const fill = activeKind === "mask" ? 0x000000 : 0xffffff;
    const cells: Cell[] = mapCells.map(([mx, my]) => [
      shape.firstVertexX + mx - 0.5,
      shape.topVertexY - my - 0.5,
    ]);
    // Key includes the brush center for sized brushes (cells move with the
    // cursor); the "all" branch is cursor-independent so it stays stable.
    const newKey = size === "all"
      ? `mask|${activeKind}|all`
      : `mask|${activeKind}|${size}|${shapeKey}|${centerMapX}|${centerMapY}`;
    if (newKey !== cachedKey) {
      preview.setArea(cells, fill);
      cachedKey = newKey;
      cachedCellSet = null;
    }
    const centerKey = `${vx - 0.5}|${vy - 0.5}`;
    if (centerKey !== cachedCenter) {
      preview.setCenter([vx - 0.5, vy - 0.5]);
      cachedCenter = centerKey;
    }
    preview.visible = true;
    return;
  }

  const cx = Math.round(blueprint.position.x - 0.5);
  const cy = Math.round(blueprint.position.y - 0.5);
  const mode = editorTileModeVar();
  const vc = blueprint.vertexColor;

  // Fast path for "fill": if the cursor is still inside the previously cached
  // flood region with the same source value AND the same selection, the fill
  // is unchanged. Just slide the center crosshair.
  if (
    cachedCellSet &&
    editorBrushSizeVar() === "fill" &&
    cachedKey ===
      `fill|${mode}|${vc}|${
        getSourceValue(mode, vc, cx, cy)
      }|${selectionKey()}` &&
    cachedCellSet.has(cy * 100000 + cx)
  ) {
    const centerKey = `${cx}|${cy}`;
    if (centerKey !== cachedCenter) {
      preview.setCenter([cx, cy]);
      cachedCenter = centerKey;
    }
    preview.visible = true;
    return;
  }

  const result = computeCells(mode, vc, cx, cy);
  if (!result) {
    cachedKey = "";
    cachedCellSet = null;
    cachedCenter = "";
    return preview.hide();
  }

  // Skip the geometry rebuild when nothing relevant changed (e.g. "all" — the
  // cell set never changes as the cursor moves; only the cross moves).
  if (result.key !== cachedKey) {
    preview.setArea(result.cells, getFillColor(mode, vc));
    cachedKey = result.key;
    cachedCellSet = new Set();
    for (const [x, y] of result.cells) cachedCellSet.add(y * 100000 + x);
  }

  const centerKey = `${cx}|${cy}`;
  if (centerKey !== cachedCenter) {
    preview.setCenter([cx, cy]);
    cachedCenter = centerKey;
  }
  preview.visible = true;
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
      cachedKey = "";
      cachedCellSet = null;
      cachedCenter = "";
      preview?.hide();
    }
  });
};

init();
