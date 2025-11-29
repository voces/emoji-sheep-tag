import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import {
  getCliffHeight,
  getCliffMapFromCliffMask,
} from "@/shared/pathing/terrainHelpers.ts";

export type Cliff = number | "r";
export type CliffMask = Cliff[][];

// Bevel size calculation - matches original behavior with floating point cliff heights
const getBevelSize = (cliffValue: number) => 0.5 / Math.pow(2, cliffValue);

// Cache for cliff heights - reset per computeGround call
let cliffHeightCache: Map<number, number>;

const getCachedCliffHeight = (
  x: number,
  y: number,
  cliffMask: CliffMask,
): number => {
  const key = y * 10000 + x;
  let height = cliffHeightCache.get(key);
  if (height === undefined) {
    height = getCliffHeight(x, y, cliffMask);
    cliffHeightCache.set(key, height);
  }
  return height;
};

// Compute vertex coordinates without Vector3 allocation
const computeVertex = (
  x: number,
  y: number,
  cliffMap: boolean[][],
  cliffMask: CliffMask,
  xOffset: number,
  yOffset: number,
): [number, number] => {
  let xCoord = x;
  let yCoord = y;

  const normX = Math.round(x + (xOffset === -1 ? 0 : xOffset));
  const normY = Math.round(y + (yOffset === -1 ? 0 : yOffset));

  let bevel: number;
  if (normX % 2 !== normY % 2) {
    // Average bevel of neighboring cliff cells - unrolled loop
    let sum = 0;
    let count = 0;
    if (cliffMap[normY]?.[normX]) {
      sum += getBevelSize(getCachedCliffHeight(normX, normY, cliffMask));
      count++;
    }
    if (cliffMap[normY]?.[normX - 1]) {
      sum += getBevelSize(getCachedCliffHeight(normX - 1, normY, cliffMask));
      count++;
    }
    if (cliffMap[normY - 1]?.[normX - 1]) {
      sum += getBevelSize(
        getCachedCliffHeight(normX - 1, normY - 1, cliffMask),
      );
      count++;
    }
    if (cliffMap[normY - 1]?.[normX]) {
      sum += getBevelSize(getCachedCliffHeight(normX, normY - 1, cliffMask));
      count++;
    }
    bevel = count > 0 ? sum / count : 0;
  } else {
    bevel = getBevelSize(getCachedCliffHeight(x, y, cliffMask));
  }

  if (xOffset === -1) xCoord += cliffMap[y]?.[x - 1] ? 0 : bevel;
  else if (xOffset === 1) xCoord += cliffMap[y]?.[x + 1] ? 1 : 1 - bevel;
  else if (xOffset === 0.25) xCoord += bevel;
  else if (xOffset === 0.75) xCoord += 1 - bevel;
  else if (xOffset !== 0) xCoord += xOffset;

  if (yOffset === -1) yCoord += cliffMap[y - 1]?.[x] ? 0 : bevel;
  else if (yOffset === 1) yCoord += cliffMap[y + 1]?.[x] ? 1 : 1 - bevel;
  else if (yOffset === 0.25) yCoord += bevel;
  else if (yOffset === 0.75) yCoord += 1 - bevel;
  else if (yOffset !== 0) yCoord += yOffset;

  return [xCoord, yCoord];
};

// Cache for adjusted colors: use nested Map for O(1) lookup without string building
// Outer map: Color object -> inner map
// Inner map: rounded height (integer after *4) -> RGB tuple
const adjustedColorCache = new WeakMap<
  Color,
  Map<number, [number, number, number]>
>();
const tempColorForAdjust = new Color();

const getAdjustedColor = (
  baseColor: Color,
  height: number,
): [number, number, number] => {
  let heightMap = adjustedColorCache.get(baseColor);
  if (!heightMap) {
    heightMap = new Map();
    adjustedColorCache.set(baseColor, heightMap);
  }

  // Use integer key: height * 4 rounded
  const heightKey = Math.round(height * 4);
  let cached = heightMap.get(heightKey);
  if (!cached) {
    const roundedHeight = heightKey / 4;
    tempColorForAdjust.copy(baseColor).offsetHSL(
      0,
      (roundedHeight - 2) / -20,
      (roundedHeight - 2) / 15,
    );
    cached = [tempColorForAdjust.r, tempColorForAdjust.g, tempColorForAdjust.b];
    heightMap.set(heightKey, cached);
  }
  return cached;
};

// Direct geometry builder - no intermediate Face2D/Vector3 objects
class GeometryBuilder {
  private vertices: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private vertexIndex = 0;
  private cliffMask: CliffMask;
  // Track bounds incrementally
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  constructor(cliffMask: CliffMask) {
    this.cliffMask = cliffMask;
  }

  private addVertex(vx: number, vy: number, baseColor: Color) {
    this.vertices.push(vx, vy, 0);
    // Track bounds
    if (vx < this.minX) this.minX = vx;
    if (vx > this.maxX) this.maxX = vx;
    if (vy < this.minY) this.minY = vy;
    if (vy > this.maxY) this.maxY = vy;

    const height = getCachedCliffHeight(
      Math.round(vx),
      Math.round(vy),
      this.cliffMask,
    );
    const [r, g, b] = getAdjustedColor(baseColor, height);
    this.colors.push(r, g, b);
    return this.vertexIndex++;
  }

  addTriangle(
    v1x: number,
    v1y: number,
    v2x: number,
    v2y: number,
    v3x: number,
    v3y: number,
    color: Color,
  ) {
    const i1 = this.addVertex(v1x, v1y, color);
    const i2 = this.addVertex(v2x, v2y, color);
    const i3 = this.addVertex(v3x, v3y, color);
    this.indices.push(i1, i2, i3);
  }

  addGroundQuad(x: number, y: number, color: Color, slash: boolean) {
    if (slash) {
      this.addTriangle(x, y, x + 1, y + 1, x + 1, y, color);
      this.addTriangle(x, y, x, y + 1, x + 1, y + 1, color);
    } else {
      this.addTriangle(x, y, x, y + 1, x + 1, y, color);
      this.addTriangle(x + 1, y + 1, x + 1, y, x, y + 1, color);
    }
  }

  addCliffTriangle(
    x: number,
    y: number,
    cliffMap: boolean[][],
    offsets: [number, number, number, number, number, number],
    color: Color,
  ) {
    const v1 = computeVertex(
      x,
      y,
      cliffMap,
      this.cliffMask,
      offsets[0],
      offsets[1],
    );
    const v2 = computeVertex(
      x,
      y,
      cliffMap,
      this.cliffMask,
      offsets[2],
      offsets[3],
    );
    const v3 = computeVertex(
      x,
      y,
      cliffMap,
      this.cliffMask,
      offsets[4],
      offsets[5],
    );
    this.addTriangle(v1[0], v1[1], v2[0], v2[1], v3[0], v3[1], color);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(this.vertices), 3),
    );
    geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(this.colors), 3),
    );
    // All vertices are z=0 (flat), so all normals point straight up
    const normals = new Float32Array(this.vertices.length);
    for (let i = 2; i < normals.length; i += 3) normals[i] = 1;
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setIndex(this.indices);
    // Use pre-computed bounds instead of iterating all vertices
    geometry.boundingBox = new Box3(
      new Vector3(this.minX, this.minY, 0),
      new Vector3(this.maxX, this.maxY, 0),
    );
    return geometry;
  }
}

// Cache tile colors to avoid repeated allocations
const tileColorCache = new Map<string, Color>();
const getTileColorCached = (colorStr: string): Color => {
  let color = tileColorCache.get(colorStr);
  if (!color) {
    color = new Color(colorStr);
    tileColorCache.set(colorStr, color);
  }
  return color;
};

const computeGround = (
  masks: { cliff: CliffMask; groundTile: number[][]; cliffTile: number[][] },
  tiles: { color: string }[],
) => {
  // Initialize cliff height cache for this computation
  cliffHeightCache = new Map();

  const defaultColor = new Color(0xff0000);

  const getTileColor = (
    x: number,
    y: number,
    tileMask: number[][],
    defaultColor: Color,
  ): Color => {
    if (tiles && tileMask) {
      const tileIndex = tileMask[y]?.[x];
      if (tileIndex !== undefined && tiles[tileIndex]) {
        return getTileColorCached(tiles[tileIndex].color);
      }
    }
    return defaultColor;
  };

  const getGroundColor = (x: number, y: number): Color =>
    getTileColor(x, y, masks.groundTile, defaultColor);

  const getCliffColor = (x: number, y: number): Color =>
    getTileColor(x, y, masks.cliffTile, defaultColor);

  const builder = new GeometryBuilder(masks.cliff);
  const cliffMap = getCliffMapFromCliffMask(masks.cliff);

  for (let y = 0; y < cliffMap.length; y++) {
    for (let x = 0; x < cliffMap[y].length; x++) {
      const tileX = Math.floor(x / 2);
      const tileY = Math.floor(y / 2);
      const groundColor = getGroundColor(tileX, tileY);
      const cliffTileColor = getCliffColor(tileX, tileY);

      if (x % 2 !== y % 2) {
        builder.addGroundQuad(x, y, groundColor, true);

        if (
          cliffMap[y][x] &&
          (cliffMap[y - 1]?.[x + 1] || cliffMap[y - 1]?.[x] ||
            cliffMap[y][x + 1])
        ) {
          if (
            !cliffMap[y - 1]?.[x + 1] && cliffMap[y][x + 1] &&
            cliffMap[y - 1]?.[x]
          ) {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [-1, -1, 1, 1, 0.75, -1],
              cliffTileColor,
            );
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [1, 1, 1, 0.25, 0.75, 0],
              cliffTileColor,
            );
          } else {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [-1, -1, 1, 1, 1, -1],
              cliffTileColor,
            );
          }
        }

        if (
          cliffMap[y][x] &&
          (cliffMap[y + 1]?.[x - 1] || cliffMap[y + 1]?.[x] ||
            cliffMap[y][x - 1])
        ) {
          if (
            !cliffMap[y + 1]?.[x - 1] && cliffMap[y][x - 1] &&
            cliffMap[y + 1]?.[x]
          ) {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [-1, -1, 0.25, 1, 1, 1],
              cliffTileColor,
            );
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [0.25, 1, -1, -1, 0, 0.75],
              cliffTileColor,
            );
          } else {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [-1, -1, -1, 1, 1, 1],
              cliffTileColor,
            );
          }
        }
      } else {
        builder.addGroundQuad(x, y, groundColor, false);

        if (
          cliffMap[y][x] &&
          (cliffMap[y - 1]?.[x - 1] || cliffMap[y - 1]?.[x] ||
            cliffMap[y][x - 1])
        ) {
          if (
            !cliffMap[y - 1]?.[x - 1] && cliffMap[y][x - 1] &&
            cliffMap[y - 1]?.[x]
          ) {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [0.25, -1, -1, 1, 1, -1],
              cliffTileColor,
            );
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [0.25, 0, 0, 0.25, -1, 1],
              cliffTileColor,
            );
          } else {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [-1, -1, -1, 1, 1, -1],
              cliffTileColor,
            );
          }
        }

        if (
          cliffMap[y][x] &&
          (cliffMap[y + 1]?.[x + 1] || cliffMap[y + 1]?.[x] ||
            cliffMap[y][x + 1])
        ) {
          if (
            !cliffMap[y + 1]?.[x + 1] && cliffMap[y][x + 1] &&
            cliffMap[y + 1]?.[x]
          ) {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [0.75, 1, 1, -1, -1, 1],
              cliffTileColor,
            );
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [1, 0.75, 1, -1, 0.75, 1],
              cliffTileColor,
            );
          } else {
            builder.addCliffTriangle(
              x,
              y,
              cliffMap,
              [1, 1, 1, -1, -1, 1],
              cliffTileColor,
            );
          }
        }
      }
    }
  }

  return builder.build();
};

const rampAllowed = (cliffMask: CliffMask, x: number, y: number) => {
  {
    const a = cliffMask[y - 1]?.[x];
    const b = cliffMask[y + 1]?.[x];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y]?.[x - 1];
    const b = cliffMask[y]?.[x + 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y - 1]?.[x - 1];
    const b = cliffMask[y + 1]?.[x + 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y - 1]?.[x + 1];
    const b = cliffMask[y + 1]?.[x - 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  return false;
};

export class Terrain2D extends Mesh {
  masks: {
    cliff: CliffMask;
    groundTile: number[][];
    cliffTile: number[][];
  };
  tiles: { color: string }[];

  constructor(
    masks: { cliff: CliffMask; groundTile: number[][]; cliffTile: number[][] },
    tiles: { color: string }[],
  ) {
    const geometry = computeGround(masks, tiles);

    super(geometry, new MeshBasicMaterial({ vertexColors: true, side: 1 }));

    this.masks = masks;
    this.tiles = tiles;
  }

  getCliff(x: number, y: number) {
    return Math.floor(getCliffHeight(
      x * 2,
      y * 2,
      this.masks.cliff,
    ));
  }

  setCliff(x: number, y: number, value: number | "r") {
    if (value === "r") {
      if (this.masks.cliff[y][x] === "r") value = this.getCliff(x, y);
      else if (!rampAllowed(this.masks.cliff, x, y)) return;
    } else {
      if (value < 0) value = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (
            this.masks.cliff[y + dy]?.[x + dx] === "r" &&
            !rampAllowed(this.masks.cliff, x + dx, y + dy)
          ) {
            this.masks.cliff[y][x] = getCliffHeight(
              (x + dx) * 2,
              (y + dy) * 2,
              this.masks.cliff,
            );
          }
        }
      }
    }

    this.masks.cliff[y][x] = value;
    const geometry = computeGround(this.masks, this.tiles);
    this.geometry.dispose();
    this.geometry = geometry;
  }

  setGroundTile(x: number, y: number, value: number) {
    this.masks.groundTile[y][x] = value;
    const geometry = computeGround(this.masks, this.tiles);
    this.geometry.dispose();
    this.geometry = geometry;
  }

  load(
    masks: { cliff: CliffMask; groundTile: number[][]; cliffTile: number[][] },
    tiles: { color: string }[],
  ) {
    this.masks = masks;
    this.tiles = tiles;
    const geometry = computeGround(this.masks, this.tiles);
    this.geometry.dispose();
    this.geometry = geometry;
  }
}
