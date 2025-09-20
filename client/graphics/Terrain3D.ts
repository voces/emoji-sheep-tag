// https://github.com/mrdoob/three.js/blob/master/examples/js/objects/Water2.js

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshMatcapMaterial,
  Vector3,
} from "three";
import { memoize } from "@/shared/pathing/memoize.ts";

// import { water } from "../../colors";
// import { faceColorMaterial, waterMaterial } from "../../materials";
// import memoize from "../../util/memoize";

export type Cliff = number | "r";
export type CliffMask = Cliff[][];

const water = new Color(0x182190);
const waterMaterial = new MeshMatcapMaterial({
  color: 0x182190,
  flatShading: true,
  opacity: 0.5,
  transparent: true,
});
export const faceColorMaterial = () =>
  new MeshMatcapMaterial({
    vertexColors: true,
    flatShading: true,
  });

const memoizedColor = memoize((hex) => new Color(hex));

const tileFaceVertices = (
  vertices: [Vector3, Vector3, Vector3, Vector3],
  which: boolean,
) =>
  <[Vector3, Vector3, Vector3]> (
    (which ? [1, 0, 2] : [1, 2, 3]).map((index) => vertices[index])
  );

const wallVertices = (
  vertices: [Vector3, Vector3, Vector3, Vector3],
  vertical: boolean,
  low: boolean,
  first: boolean,
) =>
  <[Vector3, Vector3, Vector3]> (
    (
      (vertical && low && first && [1, 0, 2]) ||
      (vertical && low && !first && [1, 2, 3]) ||
      (vertical && !low && first && [2, 0, 1]) ||
      (vertical && !low && !first && [2, 1, 3]) ||
      (!vertical && low && first && [2, 0, 1]) ||
      (!vertical && low && !first && [2, 1, 3]) ||
      (!vertical && !low && first && [1, 0, 2]) || [1, 2, 3]
    ).map((index) => vertices[index])
  );

// Randomly rotate 50% of squares
const rotate = (faces: Face3[]) => {
  for (let i = 0; i < faces.length / 2; i++) {
    if (Math.random() < 0.5) {
      faces[i * 2].c = faces[i * 2 + 1].c;
      faces[i * 2 + 1].a = faces[i * 2].b;
    }
  }
};

const nudge = (factor = 1) =>
  (Math.random() - 0.5) * (Math.random() - 0.5) * factor;

// Randomly move vertices a bit (so we don't have completely flat surfaces)
const noise = (vertexMap: (Vector3[] & { water?: Vector3 })[][]) => {
  for (const l1 of vertexMap) {
    if (l1) {
      for (const l2 of l1) {
        if (l2) {
          for (const l3 of l2) {
            if (!l3) continue;
            l3.x += nudge(0.2);
            l3.y += nudge(0.2);
            l3.z += nudge(0.1);
          }
        }
      }
    }
  }
};

const findLastIndex = <T>(
  arr: T[],
  fn: (value: T) => boolean,
  fromIndex = arr.length - 1,
) => {
  for (let i = fromIndex; i >= 0; i--) if (fn(arr[i])) return i;

  return -1;
};

export const CORNERS = {
  TOP_LEFT: { x: -1, y: -1 },
  TOP_RIGHT: { x: 1, y: -1 },
  BOTTOM_LEFT: { x: -1, y: 1 },
  BOTTOM_RIGHT: { x: 1, y: 1 },
};

export const calcCliffHeightCorner = (
  cliffMask: CliffMask,
  x: number,
  y: number,
  direction: { x: number; y: number },
): number => {
  const cliffHeight = cliffMask[y]?.[x];
  if (typeof cliffHeight === "number") return cliffHeight;

  const checks = [{ ...direction }];
  if (direction.x !== 0 && direction.y !== 0) {
    checks.push({ x: 0, y: direction.y }, { x: direction.x, y: 0 });
  }

  const heights = checks.map(
    ({ x: xD, y: yD }) => cliffMask[y + yD]?.[x + xD],
  );

  const max = heights.reduce<number>(
    (max, v) => (typeof v === "number" && v > max ? v : max),
    -Infinity,
  );

  if (heights.every((v) => typeof v === "number")) return max;

  const rampHeights = heights.map((v, i) => {
    if (v !== "r") return NaN;

    let cornerHeight: Cliff = "r";
    let xCorner = x + checks[i].x;
    let yCorner = y + checks[i].y;
    while (cornerHeight === "r") {
      cornerHeight = cliffMask[yCorner][xCorner];
      xCorner += checks[i].x;
      yCorner += checks[i].y;
    }

    let oppositeHeight: Cliff = "r";
    let xOpposite = x - checks[i].x;
    let yOpposite = y - checks[i].y;
    while (oppositeHeight === "r") {
      oppositeHeight = cliffMask[yOpposite][xOpposite];
      xOpposite -= checks[i].x;
      yOpposite -= checks[i].y;
    }

    if (
      cornerHeight === oppositeHeight &&
      checks[i].x !== 0 &&
      checks[i].y !== 0
    ) {
      let adjacentHeight: Cliff = "r";
      let xAdjacent = x - checks[i].x;
      let yAdjacent = y + checks[i].y;
      while (adjacentHeight === "r") {
        adjacentHeight = cliffMask[yAdjacent][xAdjacent];
        xAdjacent -= checks[i].x;
        yAdjacent += checks[i].y;
      }

      let adjacentOppositeHeight: Cliff = "r";
      let xAdjacentOpposite = x + checks[i].x;
      let yAdjacentOpposite = y - checks[i].y;
      while (adjacentOppositeHeight === "r") {
        adjacentOppositeHeight =
          cliffMask[yAdjacentOpposite][xAdjacentOpposite];
        xAdjacentOpposite += checks[i].x;
        yAdjacentOpposite -= checks[i].y;
      }

      return Math.max((adjacentHeight + adjacentOppositeHeight) / 2, max);
    }

    return Math.max((cornerHeight + oppositeHeight) / 2, max);
  });

  const rampHeight = rampHeights.reduce(
    (max, v) => (!isNaN(v) && v > max ? v : max),
    -Infinity,
  );

  return rampHeight;
};

export const calcCliffHeight = (
  cliffMask: CliffMask,
  x: number,
  y: number,
): {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
} => {
  const cliffHeight = cliffMask[y]?.[x];
  if (typeof cliffHeight === "number") {
    return {
      topLeft: cliffHeight,
      topRight: cliffHeight,
      bottomLeft: cliffHeight,
      bottomRight: cliffHeight,
    };
  }

  const [topLeft, topRight, bottomLeft, bottomRight] = Object.values(
    CORNERS,
  ).map((direction) => calcCliffHeightCorner(cliffMask, x, y, direction));

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  };
};

class Face3 {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  color: Color;
  constructor(a: Vector3, b: Vector3, c: Vector3, color: Color) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.color = color;
  }
}

// Extends Group instead so water doesn't cast/receive Shadows
export class Terrain3D extends Group {
  vertices: (Vector3[] & { water?: Vector3 })[][];
  /** Y-major, with y index being flipped, so y=0 is the bottom */
  groundFaces = <[Face3, Face3][][]> [];
  width: number;
  height: number;

  ground: BufferGeometry;
  water: BufferGeometry;

  groundColor: (x: number, y: number) => Color;
  cliffColor: (x: number, y: number) => Color;

  constructor(terrain: {
    masks: {
      // y-major, height+1 x width+1
      height: number[][];
      cliff: CliffMask;
      groundTile: number[][];
      cliffTile: number[][];
      water: number[][];
      waterHeight: number[][];
    };
    offset: { x: number; y: number; z: number };
    tiles: { color: string }[];
    size: {
      width: number;
      height: number;
    };
  }) {
    super();
    this.vertices = [];

    this.groundColor = memoize((x, y) => {
      try {
        const hex = terrain.tiles[
          terrain.masks.groundTile[y][x]
        ].color.toUpperCase();
        return memoizedColor(hex);
      } catch {
        throw new Error(
          `Tile ( ${x}, ${y} ) uses undefined color ${
            terrain.masks.groundTile[y][x]
          }.`,
        );
      }
    });

    this.cliffColor = memoize((x, y) => {
      try {
        const hex = terrain.tiles[
          terrain.masks.cliffTile[y][x]
        ].color.toUpperCase();
        return memoizedColor(hex);
      } catch {
        throw new Error(
          `Tile ( ${x}, ${y} ) uses undefined color ${
            terrain.masks.cliffTile[y][x]
          }.`,
        );
      }
    });

    const { width, height } = terrain.size;
    this.width = width;
    this.height = height;

    {
      const { geometry, material } = this._computeGround({
        height: terrain.masks.height,
        cliff: terrain.masks.cliff,
        offset: terrain.offset,
      });

      this.ground = geometry;

      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.add(mesh);
    }

    {
      const { geometry, material } = this._computeWater({
        water: terrain.masks.water,
        waterHeight: terrain.masks.waterHeight,
        offset: terrain.offset,
      });

      this.water = geometry;

      this.add(new Mesh(geometry, material));
    }
  }

  private _computeGround({
    height: heightMask,
    cliff: cliffMask,
    offset,
  }: {
    height: number[][];
    cliff: CliffMask;
    offset: { x: number; y: number; z: number };
  }): { geometry: BufferGeometry; material: Material } {
    const allFaces: Face3[] = [];

    const vertex = (x: number, y: number, z: number, offset: number) => {
      const existing = this.vertices[x]?.[y]?.[z];
      if (existing !== undefined) return existing;

      if (this.vertices[x] === undefined) this.vertices[x] = [];
      if (this.vertices[x][y] === undefined) this.vertices[x][y] = [];
      const vector = new Vector3(x, -y, z + offset);
      this.vertices[x][y][z] = vector;
      return vector;
    };

    const rampWalls: Face3[] = [];

    for (let y = this.height - 1; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        const cliffTile = cliffMask[y][x];
        if (cliffTile !== "r" && isNaN(cliffTile)) continue;

        const topLeft = heightMask[y][x];
        const topRight = heightMask[y][x + 1];
        const botLeft = heightMask[y + 1][x];
        const botRight = heightMask[y + 1][x + 1];

        if (typeof cliffTile === "number") {
          // Floor
          const vertices: [Vector3, Vector3, Vector3, Vector3] = [
            vertex(x, y, cliffTile, topLeft),
            vertex(x + 1, y, cliffTile, topRight),
            vertex(x, y + 1, cliffTile, botLeft),
            vertex(x + 1, y + 1, cliffTile, botRight),
          ];
          const aVertices = tileFaceVertices(vertices, true);
          const bVertices = tileFaceVertices(vertices, false);
          const faces: [Face3, Face3] = [
            new Face3(
              aVertices[0],
              aVertices[1],
              aVertices[2],
              this.groundColor(x, y),
            ),
            new Face3(
              bVertices[0],
              bVertices[1],
              bVertices[2],
              this.groundColor(x, y),
            ),
          ];
          if (!this.groundFaces[y]) this.groundFaces[y] = [];
          this.groundFaces[y][x] = faces;
          allFaces.push(...faces);

          // Left wall (next gets right)
          if (x > 0 && cliffMask[y][x - 1] !== undefined) {
            const altHeight = this._tileHeight(cliffMask, x - 1, y);
            const currentIsLow = cliffTile < altHeight;
            const low = currentIsLow ? cliffTile : altHeight;
            const high = currentIsLow ? altHeight : cliffTile;

            for (let z = low; z < high; z++) {
              const vertices: [
                Vector3,
                Vector3,
                Vector3,
                Vector3,
              ] = [
                vertex(x, y, z, topLeft),
                vertex(x, y + 1, z, botLeft),
                vertex(x, y, z + 1, topLeft),
                vertex(x, y + 1, z + 1, botLeft),
              ];
              const aVertices = wallVertices(
                vertices,
                true,
                currentIsLow,
                true,
              );
              const bVertices = wallVertices(
                vertices,
                true,
                currentIsLow,
                false,
              );
              allFaces.push(
                new Face3(
                  aVertices[0],
                  aVertices[1],
                  aVertices[2],
                  this.cliffColor(x, y),
                ),
                new Face3(
                  bVertices[0],
                  bVertices[1],
                  bVertices[2],
                  this.cliffColor(x, y),
                ),
              );
            }
          }

          // Top wall (next gets bottom)
          if (y > 0 && cliffMask[y - 1][x] !== undefined) {
            const altHeight = this._tileHeight(cliffMask, x, y - 1);
            const currentIsLow = cliffTile < altHeight;
            const low = currentIsLow ? cliffTile : altHeight;
            const high = currentIsLow ? altHeight : cliffTile;

            for (let z = low; z < high; z++) {
              const vertices: [
                Vector3,
                Vector3,
                Vector3,
                Vector3,
              ] = [
                vertex(x, y, z, topLeft),
                vertex(x + 1, y, z, topRight),
                vertex(x, y, z + 1, topLeft),
                vertex(x + 1, y, z + 1, topRight),
              ];
              const aVertices = wallVertices(
                vertices,
                false,
                currentIsLow,
                true,
              );
              const bVertices = wallVertices(
                vertices,
                false,
                currentIsLow,
                false,
              );
              allFaces.push(
                new Face3(
                  aVertices[0],
                  aVertices[1],
                  aVertices[2],
                  this.cliffColor(x, y),
                ),
                new Face3(
                  bVertices[0],
                  bVertices[1],
                  bVertices[2],
                  this.cliffColor(x, y),
                ),
              );
            }
          }
        } else if (cliffTile.toLowerCase() === "r") {
          const {
            topLeft: topLeftCliff,
            topRight: topRightCliff,
            bottomLeft: botLeftCliff,
            bottomRight: botRightCliff,
          } = calcCliffHeight(cliffMask, x, y);

          const vertices: [Vector3, Vector3, Vector3, Vector3] = [
            vertex(x, y, topLeftCliff, topLeft),
            vertex(x + 1, y, topRightCliff, topRight),
            vertex(x, y + 1, botLeftCliff, botLeft),
            vertex(x + 1, y + 1, botRightCliff, botRight),
          ];
          const aVertices = tileFaceVertices(vertices, true);
          const bVertices = tileFaceVertices(vertices, false);
          const faces: [Face3, Face3] = [
            new Face3(
              aVertices[0],
              aVertices[1],
              aVertices[2],
              this.groundColor(x, y),
            ),
            new Face3(
              bVertices[0],
              bVertices[1],
              bVertices[2],
              this.groundColor(x, y),
            ),
          ];
          if (!this.groundFaces[y]) this.groundFaces[y] = [];
          this.groundFaces[y][x] = faces;
          allFaces.push(...faces);

          const corners = [
            topLeftCliff,
            topRightCliff,
            botLeftCliff,
            botRightCliff,
          ];
          const walls = [
            { a: 0, b: 1, neighbor: { x: 0, y: -1 } },
            { a: 1, b: 3, neighbor: { x: 1, y: 0 } },
            { a: 3, b: 2, neighbor: { x: 0, y: 1 } },
            { a: 2, b: 0, neighbor: { x: -1, y: 0 } },
          ];
          for (let i = 0; i < walls.length; i++) {
            // Don't put triangles on the edge
            const neighborCliffMaskTile = cliffMask[y + walls[i].neighbor.y]?.[
              x + walls[i].neighbor.x
            ];
            if (
              neighborCliffMaskTile !== undefined &&
              typeof neighborCliffMaskTile === "string"
            ) {
              continue;
            }

            const z = Math.min(
              corners[walls[i].a],
              corners[walls[i].b],
            );

            const a = vertices[walls[i].a];
            const b = vertices[walls[i].b];

            if (a.z !== b.z && (a.x === b.x || a.y === b.y)) {
              const height = Math.min(a.z, b.z);
              const { x: vX, y: vY } = a.z === height ? b : a;
              // vertex inverts y, so we invert it first...
              const v = vertex(vX, -vY, z, height - z);

              rampWalls.push(
                new Face3(a, b, v, this.cliffColor(x, y)),
              );
            }
          }

          const minHeight = Math.min(
            topLeftCliff,
            topRightCliff,
            botLeftCliff,
            botRightCliff,
          );
          if (isNaN(minHeight)) console.warn("Got a NaN!");

          // Left wall (next gets right; ONLY for squares, not triangle its)
          if (topLeftCliff !== botLeftCliff && x > 0) {
            const rawCliffLeft = cliffMask[y][x - 1];
            const cliffLeft = typeof rawCliffLeft === "number"
              ? rawCliffLeft
              : -Infinity;
            const currentIsLow = minHeight < cliffLeft;
            const low = currentIsLow ? minHeight : cliffLeft;
            const high = currentIsLow ? cliffLeft : minHeight;

            if (
              isNaN(low) ||
              isNaN(high) ||
              !isFinite(low) ||
              !isFinite(high)
            ) {
              continue;
            }

            for (let z = low; z < high; z++) {
              const vertices: [
                Vector3,
                Vector3,
                Vector3,
                Vector3,
              ] = [
                vertex(x, y, z, topLeft),
                vertex(x, y + 1, z, botLeft),
                vertex(x, y, z + 1, topLeft),
                vertex(x, y + 1, z + 1, botLeft),
              ];
              const aVertices = wallVertices(
                vertices,
                true,
                currentIsLow,
                true,
              );
              const bVertices = wallVertices(
                vertices,
                true,
                currentIsLow,
                false,
              );
              allFaces.push(
                new Face3(
                  aVertices[0],
                  aVertices[1],
                  aVertices[2],
                  this.cliffColor(x, y),
                ),
                new Face3(
                  bVertices[0],
                  bVertices[1],
                  bVertices[2],
                  this.cliffColor(x, y),
                ),
              );
            }
          }

          // Top wall (next gets bottom; ONLY for squares, not triangle its)
          if (topLeftCliff !== topRightCliff && y > 0) {
            const rawCliffAbove = cliffMask[y - 1][x];
            const cliffAbove = typeof rawCliffAbove === "number"
              ? rawCliffAbove
              : -Infinity;
            const currentIsLow = minHeight < cliffAbove;
            const low = currentIsLow ? minHeight : cliffAbove;
            const high = currentIsLow ? cliffAbove : minHeight;

            if (
              isNaN(low) ||
              isNaN(high) ||
              !isFinite(low) ||
              !isFinite(high)
            ) {
              continue;
            }

            for (let z = low; z < high; z++) {
              const vertices: [
                Vector3,
                Vector3,
                Vector3,
                Vector3,
              ] = [
                vertex(x, y, z, topLeft),
                vertex(x + 1, y, z, topRight),
                vertex(x, y, z + 1, topLeft),
                vertex(x + 1, y, z + 1, topRight),
              ];
              const aVertices = wallVertices(
                vertices,
                false,
                currentIsLow,
                true,
              );
              const bVertices = wallVertices(
                vertices,
                false,
                currentIsLow,
                false,
              );
              allFaces.push(
                new Face3(
                  aVertices[0],
                  aVertices[1],
                  aVertices[2],
                  this.cliffColor(x, y),
                ),
                new Face3(
                  bVertices[0],
                  bVertices[1],
                  bVertices[2],
                  this.cliffColor(x, y),
                ),
              );
            }
          }
        }
      }
    }

    rotate(allFaces);

    // We add ramp walls after since they are single triangles
    allFaces.push(...rampWalls);

    // noise(this.vertices);

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array(
          allFaces.flatMap((face) =>
            [face.a, face.b, face.c].flatMap((v) => [
              v.x,
              v.y,
              v.z,
            ])
          ),
        ),
        3,
      ),
    );

    geometry.setAttribute(
      "color",
      new BufferAttribute(
        new Float32Array(
          allFaces.flatMap((face) => [
            face.color.r,
            face.color.g,
            face.color.b,
            face.color.r,
            face.color.g,
            face.color.b,
            face.color.r,
            face.color.g,
            face.color.b,
          ]),
        ),
        3,
      ),
    );

    geometry.computeVertexNormals();

    // Center x & y
    geometry.translate(-offset.x, offset.y, offset.z);

    return { geometry, material: faceColorMaterial() };
  }

  private _computeWater({
    water: waterMask,
    waterHeight: waterHeightMask,
    offset,
  }: {
    water: number[][];
    waterHeight: number[][];
    offset: { x: number; y: number; z: number };
  }): { geometry: BufferGeometry; material: Material } {
    const faces: Face3[] = [];

    // This makes the water hug the cliff, it's not 100% between edges,
    // but is at the edge, which is what matters most
    const vertex = (x: number, y: number, waterHeight: number) => {
      const existing = this.vertices[x]?.[y]?.water;
      if (existing !== undefined) return existing;
      if (this.vertices[x] === undefined) this.vertices[x] = [];
      if (this.vertices[x][y] === undefined) this.vertices[x][y] = [];

      waterHeight += 3 / 8 + offset.z;

      const groundVertices = this.vertices[x][y];
      if (!groundVertices || !groundVertices.length) {
        throw new Error("Expected ground where there is water");
      }
      const cliff = Math.floor(waterHeight);
      const trueLowIndex = findLastIndex(groundVertices, Boolean, cliff);
      const lowIndex = trueLowIndex < 0
        ? groundVertices.findIndex(Boolean)
        : trueLowIndex;
      const low = groundVertices[lowIndex];
      const high = groundVertices.length - 1 !== lowIndex
        ? groundVertices[groundVertices.length - 1]
        : undefined;

      let vector;

      // Water is at a cliff, interpolate between them
      if (high) {
        const alpha = (waterHeight - low.z) / (high.z - low.z);
        vector = low.clone().lerp(high, alpha);

        // Water is in the open, just project straight up
        // We only nudge open water to make sure cliff edges are touched
      } else vector = low.clone().setZ(waterHeight + nudge(1 / 8));

      this.vertices[x][y].water = vector;
      return vector;
    };

    for (let y = this.height - 1; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        if (waterMask[y][x]) {
          const topLeft = waterHeightMask[y][x];
          const topRight = waterHeightMask[y][x + 1];
          const botLeft = waterHeightMask[y + 1][x];
          const botRight = waterHeightMask[y + 1][x + 1];

          const vertices: [Vector3, Vector3, Vector3, Vector3] = [
            vertex(x, y, topLeft),
            vertex(x + 1, y, topRight),
            vertex(x, y + 1, botLeft),
            vertex(x + 1, y + 1, botRight),
          ];
          faces.push(
            new Face3(...tileFaceVertices(vertices, true), water),
            new Face3(...tileFaceVertices(vertices, false), water),
          );
        }
      }
    }

    rotate(faces);

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array(
          faces.flatMap((face) =>
            [face.a, face.b, face.c].flatMap((v) => [
              v.x,
              v.y,
              v.z,
            ])
          ),
        ),
        3,
      ),
    );

    geometry.setAttribute(
      "color",
      new BufferAttribute(
        new Float32Array(
          faces.flatMap((face) => [
            face.color.r,
            face.color.g,
            face.color.b,
            face.color.r,
            face.color.g,
            face.color.b,
            face.color.r,
            face.color.g,
            face.color.b,
          ]),
        ),
        3,
      ),
    );

    // Center x & y
    geometry.translate(-offset.x, offset.y, offset.z);

    return { geometry, material: waterMaterial };
  }

  // Returns either the known height or calculated height of a tile
  private _tileHeight(cliffMask: CliffMask, x: number, y: number): number {
    const raw = cliffMask[y][x];

    // Known height
    if (typeof raw === "number") return raw;

    const { topLeft, topRight, bottomLeft, bottomRight } = calcCliffHeight(
      cliffMask,
      x,
      y,
    );

    return Math.min(
      ...[topLeft, topRight, bottomLeft, bottomRight].filter(
        (v) => !isNaN(v) && Number.isFinite(v),
      ),
    );
  }
}
