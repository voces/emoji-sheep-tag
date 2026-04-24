import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { appContext } from "@/shared/context.ts";
import { Entity } from "@/shared/types.ts";
import {
  buildCliffDistanceField,
  type CliffMask,
  type DoodadPoint,
  type WaterMask,
} from "./graphics/Terrain2D.ts";
import { getCliffHeight } from "@/shared/pathing/terrainHelpers.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";

// Deterministic hash matching the GLSL waterHash(vec2)
const hash = (x: number, y: number) => {
  const dot = x * 127.1 + y * 311.7;
  const s = Math.sin(dot) * 43758.5453123;
  return s - Math.floor(s);
};

const CELL_SIZE = 2.0;
const SPAWN_PROBABILITY = 0.15;
const MIN_DOODAD_DIST = 1.5;
// Distance field is at 4× cliff mask resolution (1 world unit = 4 texels, maxR = 12)
const CLIFF_DIST_MIN = 2; // too close = on cliff face (~0.5 world units)
const CLIFF_DIST_MAX = 12; // maxR = 12, so anything < 12 is near a cliff

const flowers = new Map<string, Entity>();

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

const makeFlowerProps = (cx: number, cy: number) => {
  const h0 = hash(cx, cy);
  const h1 = hash(cx + 127.1, cy + 311.7);
  const h2 = hash(cx + 269.5, cy + 183.3);
  const h3 = hash(cx + 419.2, cy + 371.9);
  const h4 = hash(cx + 631.7, cy + 213.1);

  const jitterX = (h1 - 0.5) * CELL_SIZE * 0.8;
  const jitterY = (h2 - 0.5) * CELL_SIZE * 0.8;

  const r = h1;
  const g = h2;
  const b = h3;
  const scale = Math.min(1 / r, 1 / g, 1 / b) * 255;
  const toHex = (v: number) =>
    Math.floor(v * scale).toString(16).padStart(2, "0");

  return {
    x: (cx + 0.5) * CELL_SIZE + jitterX,
    y: (cy + 0.5) * CELL_SIZE + jitterY,
    modelScale: 0.5 + h0 * 3,
    playerColor: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
    facing: Math.round(h4) * Math.PI,
  };
};

type TerrainData = {
  cliff: CliffMask;
  groundTile: number[][];
  water: WaterMask;
  doodads: DoodadPoint[];
};

export const regenerateFlowers = (td: TerrainData) => {
  const mapW = td.cliff[0]?.length ?? 0;
  const mapH = td.cliff.length;
  if (!mapW || !mapH) return;

  const cliffField = buildCliffDistanceField(td.cliff);

  const cellsX = Math.ceil(mapW / CELL_SIZE);
  const cellsY = Math.ceil(mapH / CELL_SIZE);

  const desired = new Set<string>();

  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      if (hash(cx, cy) >= SPAWN_PROBABILITY) continue;

      const props = makeFlowerProps(cx, cy);
      const { x: wx, y: wy } = props;

      // Out of bounds
      if (wx < 0.5 || wx >= mapW - 0.5 || wy < 0.5 || wy >= mapH - 0.5) {
        continue;
      }

      // Ground tile check (only grass = index 0)
      const tileX = Math.floor(wx);
      const tileY = Math.floor(wy);
      if ((td.groundTile[tileY]?.[tileX] ?? 1) !== 0) continue;

      // Water check: compare water level to ground height
      const waterLevel = (td.water[tileY]?.[tileX] ?? 0) / WATER_LEVEL_SCALE;
      const groundHeight = getCliffHeight(wx * 2, wy * 2, td.cliff);
      if (waterLevel > groundHeight) continue;

      // Cliff distance check (4× resolution)
      const cfX = Math.min(Math.floor(wx * cliffField.scale), cliffField.w - 1);
      const cfY = Math.min(
        Math.floor(wy * cliffField.scale),
        cliffField.h - 1,
      );
      const cliffDist = cliffField.dist[cfY * cliffField.w + cfX];
      if (cliffDist < CLIFF_DIST_MIN || cliffDist > CLIFF_DIST_MAX) continue;

      // Doodad distance check
      let tooClose = false;
      for (const d of td.doodads) {
        const dx = wx - d.x;
        const dy = wy - d.y;
        if (dx * dx + dy * dy < (MIN_DOODAD_DIST + d.radius) ** 2) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      desired.add(cellKey(cx, cy));
    }
  }

  const app = appContext.current;
  app.batch(() => {
    // Prune stale entries (removed by unloadEcs etc.)
    for (const [key, entity] of flowers) {
      if (!app.entities.has(entity)) flowers.delete(key);
    }

    // Remove flowers no longer desired
    for (const [key, entity] of flowers) {
      if (!desired.has(key)) {
        removeEntity(entity);
        flowers.delete(key);
      }
    }

    // Add flowers for new cells
    for (const key of desired) {
      if (flowers.has(key)) continue;
      const [cxStr, cyStr] = key.split(",");
      const props = makeFlowerProps(Number(cxStr), Number(cyStr));
      const entity = addEntity({
        prefab: "flowers",
        position: { x: props.x, y: props.y },
        modelScale: props.modelScale,
        playerColor: props.playerColor,
        facing: props.facing,
        isEffect: true,
      });
      flowers.set(key, entity);
    }
  });
};

export const clearGeneratedFlowers = () => {
  if (!flowers.size) return;
  const app = appContext.current;
  app.batch(() => {
    for (const entity of flowers.values()) {
      if (app.entities.has(entity)) removeEntity(entity);
    }
    flowers.clear();
  });
};
