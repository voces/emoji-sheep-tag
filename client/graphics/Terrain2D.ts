import {
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

class Face2D {
  vertices: Vector3[];
  color: Color;

  constructor(vertices: Vector3[], color: Color) {
    this.vertices = vertices;
    this.color = color;
  }
}

const addGroundFaces = (
  faces: Face2D[],
  x: number,
  y: number,
  groundColor: Color,
  diagonalType: "slash" | "backslash",
) => {
  if (diagonalType === "slash") {
    faces.push(
      new Face2D(
        [
          new Vector3(x, y, 0),
          new Vector3(x + 1, y + 1, 0),
          new Vector3(x + 1, y, 0),
        ],
        groundColor,
      ),
      new Face2D(
        [
          new Vector3(x, y, 0),
          new Vector3(x, y + 1, 0),
          new Vector3(x + 1, y + 1, 0),
        ],
        groundColor,
      ),
    );
  } else {
    faces.push(
      new Face2D(
        [
          new Vector3(x, y, 0),
          new Vector3(x, y + 1, 0),
          new Vector3(x + 1, y, 0),
        ],
        groundColor,
      ),
      new Face2D(
        [
          new Vector3(x + 1, y + 1, 0),
          new Vector3(x + 1, y, 0),
          new Vector3(x, y + 1, 0),
        ],
        groundColor,
      ),
    );
  }
};

const getBevelSize = (cliffValue: number) => 0.5 / Math.pow(2, cliffValue);

const createVector3 = (
  x: number,
  y: number,
  cliffMap: boolean[][],
  cliffMask: CliffMask,
  xOffset: number,
  yOffset: number,
): Vector3 => {
  let xCoord = x;
  let yCoord = y;

  const normalized = {
    x: Math.round(x + (xOffset === -1 ? 0 : xOffset)),
    y: Math.round(y + (yOffset === -1 ? 0 : yOffset)),
  };

  const bevel = normalized.x % 2 !== normalized.y % 2
    ? [
      normalized,
      { x: normalized.x - 1, y: normalized.y },
      { x: normalized.x - 1, y: normalized.y - 1 },
      { x: normalized.x, y: normalized.y - 1 },
    ].filter(({ x, y }) => cliffMap[y]?.[x])
      .map(({ x, y }) => getBevelSize(getCliffHeight(x, y, cliffMask)))
      .reduce((sum, value, _, arr) => sum + value / arr.length, 0)
    : getBevelSize(getCliffHeight(x, y, cliffMask));

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

  return new Vector3(xCoord, yCoord, 0);
};

const createGeometry = (faces: Face2D[], cliffMask: CliffMask) => {
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexIndex = 0;

  for (const face of faces) {
    if (face.vertices.length < 3) continue;

    const startIndex = vertexIndex;
    for (const vertex of face.vertices) {
      vertices.push(vertex.x, vertex.y, vertex.z);
      const height = getCliffHeight(
        Math.round(vertex.x),
        Math.round(vertex.y),
        cliffMask,
      );
      const c = face.color.clone().offsetHSL(0, 0, (height - 2) / 30);
      colors.push(c.r, c.g, c.b);
      vertexIndex++;
    }

    for (let i = 1; i < face.vertices.length - 1; i++) {
      indices.push(startIndex, startIndex + i, startIndex + i + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
};

const computeGround = (
  masks: { cliff: CliffMask; groundTile: number[][]; cliffTile: number[][] },
  tiles: { color: string }[],
) => {
  const defaultColor = new Color(0xff0000);
  const cliffColor = new Color(0xff0000);

  const getTileColor = (
    x: number,
    y: number,
    tileMask: number[][],
    defaultColor: Color,
  ): Color => {
    if (tiles && tileMask) {
      const tileIndex = tileMask[y]?.[x];
      if (tileIndex !== undefined && tiles[tileIndex]) {
        return new Color(tiles[tileIndex].color);
      }
    }
    return defaultColor;
  };

  const getGroundColor = (x: number, y: number): Color =>
    getTileColor(x, y, masks.groundTile, defaultColor);

  const getCliffColor = (x: number, y: number): Color =>
    getTileColor(x, y, masks.cliffTile, cliffColor);

  const faces: Face2D[] = [];

  const cliffMap = getCliffMapFromCliffMask(masks.cliff);

  for (let y = 0; y < cliffMap.length; y++) {
    for (let x = 0; x < cliffMap[y].length; x++) {
      const tileX = Math.floor(x / 2);
      const tileY = Math.floor(y / 2);
      const groundColor = getGroundColor(tileX, tileY);
      const cliffColor = getCliffColor(tileX, tileY);

      if (x % 2 !== y % 2) {
        addGroundFaces(faces, x, y, groundColor, "slash");

        if (
          cliffMap[y][x] &&
          (cliffMap[y - 1]?.[x + 1] || cliffMap[y - 1]?.[x] ||
            cliffMap[y][x + 1])
        ) {
          if (
            !cliffMap[y - 1]?.[x + 1] && cliffMap[y][x + 1] &&
            cliffMap[y - 1]?.[x]
          ) {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 0.75, -1),
                ],
                cliffColor,
              ),
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, 0.25),
                  createVector3(x, y, cliffMap, masks.cliff, 0.75, 0),
                ],
                cliffColor,
              ),
            );
          } else {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                ],
                cliffColor,
              ),
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
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, 0.25, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                ],
                cliffColor,
              ),
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 0.25, 1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, 0, 0.75),
                ],
                cliffColor,
              ),
            );
          } else {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                ],
                cliffColor,
              ),
            );
          }
        }
      } else {
        addGroundFaces(
          faces,
          x,
          y,
          groundColor,
          "backslash",
        );

        if (
          cliffMap[y][x] &&
          (cliffMap[y - 1]?.[x - 1] || cliffMap[y - 1]?.[x] ||
            cliffMap[y][x - 1])
        ) {
          if (
            !cliffMap[y - 1]?.[x - 1] && cliffMap[y][x - 1] &&
            cliffMap[y - 1]?.[x]
          ) {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 0.25, -1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                ],
                cliffColor,
              ),
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 0.25, 0),
                  createVector3(x, y, cliffMap, masks.cliff, 0, 0.25),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                ],
                cliffColor,
              ),
            );
          } else {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, -1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                ],
                cliffColor,
              ),
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
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 0.75, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                ],
                cliffColor,
              ),
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 1, 0.75),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, 0.75, 1),
                ],
                cliffColor,
              ),
            );
          } else {
            faces.push(
              new Face2D(
                [
                  createVector3(x, y, cliffMap, masks.cliff, 1, 1),
                  createVector3(x, y, cliffMap, masks.cliff, 1, -1),
                  createVector3(x, y, cliffMap, masks.cliff, -1, 1),
                ],
                cliffColor,
              ),
            );
          }
        }
      }
    }
  }

  return createGeometry(faces, masks.cliff);
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
}
