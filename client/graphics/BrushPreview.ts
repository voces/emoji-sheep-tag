import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three";
import type { Cell } from "../editor/brush.ts";

const CENTER_ARM_LEN = 0.22;
const CENTER_HALF_WIDTH = 0.025;
const CENTER_BLACK_HALF_WIDTH = 0.05;

const setEdgesLineGeometry = (
  geo: BufferGeometry,
  edges: ReadonlyArray<readonly [number, number, number, number]>,
) => {
  const verts = new Float32Array(edges.length * 6);
  for (let i = 0; i < edges.length; i++) {
    const [x1, y1, x2, y2] = edges[i];
    const o = i * 6;
    verts[o] = x1;
    verts[o + 1] = y1;
    verts[o + 2] = 0;
    verts[o + 3] = x2;
    verts[o + 4] = y2;
    verts[o + 5] = 0;
  }
  geo.setAttribute("position", new BufferAttribute(verts, 3));
  geo.computeBoundingSphere();
};

const writeQuad = (
  verts: Float32Array,
  i: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const o = i * 18;
  verts[o] = x1;
  verts[o + 1] = y1;
  verts[o + 2] = 0;
  verts[o + 3] = x2;
  verts[o + 4] = y1;
  verts[o + 5] = 0;
  verts[o + 6] = x2;
  verts[o + 7] = y2;
  verts[o + 8] = 0;
  verts[o + 9] = x1;
  verts[o + 10] = y1;
  verts[o + 11] = 0;
  verts[o + 12] = x2;
  verts[o + 13] = y2;
  verts[o + 14] = 0;
  verts[o + 15] = x1;
  verts[o + 16] = y2;
  verts[o + 17] = 0;
};

const setCellsFillGeometry = (
  geo: BufferGeometry,
  cells: ReadonlyArray<Cell>,
) => {
  const verts = new Float32Array(cells.length * 18);
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = cells[i];
    writeQuad(verts, i, x, y, x + 1, y + 1);
  }
  geo.setAttribute("position", new BufferAttribute(verts, 3));
  geo.computeBoundingSphere();
};

const setCrossGeometry = (
  geo: BufferGeometry,
  cx: number,
  cy: number,
  armLen: number,
  halfWidth: number,
) => {
  const verts = new Float32Array(2 * 18);
  writeQuad(verts, 0, cx - armLen, cy - halfWidth, cx + armLen, cy + halfWidth);
  writeQuad(verts, 1, cx - halfWidth, cy - armLen, cx + halfWidth, cy + armLen);
  geo.setAttribute("position", new BufferAttribute(verts, 3));
  geo.computeBoundingSphere();
};

/**
 * Editor brush overlay. Draws a translucent fill over every cell that will be
 * affected so the brush area is unmistakable, a black-then-white outline around
 * the perimeter for legibility on any terrain, and a black-haloed white "+" at
 * the brush anchor cell so line-drawing follows the cursor.
 */
export class BrushPreview extends Group {
  private fill: Mesh;
  private blackOutline: LineSegments;
  private whiteOutline: LineSegments;
  private blackCenter: Mesh;
  private whiteCenter: Mesh;

  constructor() {
    super();
    this.visible = false;

    const lineMat = (color: number, opacity: number) =>
      new LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
      });

    const meshMat = (color: number, opacity: number) =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
      });

    this.fill = new Mesh(new BufferGeometry(), meshMat(0xffffff, 0.18));
    this.blackOutline = new LineSegments(
      new BufferGeometry(),
      lineMat(0x000000, 0.9),
    );
    this.whiteOutline = new LineSegments(
      new BufferGeometry(),
      lineMat(0xffffff, 1),
    );
    this.blackCenter = new Mesh(new BufferGeometry(), meshMat(0x000000, 0.85));
    this.whiteCenter = new Mesh(new BufferGeometry(), meshMat(0xffffff, 1));

    const layers: Array<[Mesh | LineSegments, number, number]> = [
      [this.fill, 0.001, 10000],
      [this.blackOutline, 0.002, 10001],
      [this.whiteOutline, 0.003, 10002],
      [this.blackCenter, 0.004, 10003],
      [this.whiteCenter, 0.005, 10004],
    ];
    for (const [obj, z, order] of layers) {
      obj.position.z = z;
      obj.renderOrder = order;
      obj.frustumCulled = false;
      obj.raycast = () => {};
      this.add(obj);
    }
  }

  /**
   * Rebuild the area fill + outline. `cells` are world tile coords (the
   * integer cell at (x, y) covers the unit square [x..x+1] × [y..y+1]).
   * `fillColor` tints the translucent area; pass the painted tile / water
   * color so the preview matches the eventual result.
   */
  setArea(cells: ReadonlyArray<Cell>, fillColor: number) {
    if (cells.length === 0) {
      this.visible = false;
      return;
    }

    const cellSet = new Set<number>();
    for (const [x, y] of cells) cellSet.add(y * 100000 + x);

    const edges: Array<[number, number, number, number]> = [];
    for (const [x, y] of cells) {
      if (!cellSet.has((y - 1) * 100000 + x)) {
        edges.push([x, y, x + 1, y]);
      }
      if (!cellSet.has((y + 1) * 100000 + x)) {
        edges.push([x, y + 1, x + 1, y + 1]);
      }
      if (!cellSet.has(y * 100000 + (x - 1))) {
        edges.push([x, y, x, y + 1]);
      }
      if (!cellSet.has(y * 100000 + (x + 1))) {
        edges.push([x + 1, y, x + 1, y + 1]);
      }
    }

    setCellsFillGeometry(this.fill.geometry, cells);
    setEdgesLineGeometry(this.blackOutline.geometry, edges);
    setEdgesLineGeometry(this.whiteOutline.geometry, edges);
    (this.fill.material as MeshBasicMaterial).color.setHex(fillColor);

    this.visible = true;
  }

  /** Move the center crosshair to a new anchor cell without touching the fill. */
  setCenter(centerCell: Cell) {
    const [cx, cy] = centerCell;
    setCrossGeometry(
      this.blackCenter.geometry,
      cx + 0.5,
      cy + 0.5,
      CENTER_ARM_LEN,
      CENTER_BLACK_HALF_WIDTH,
    );
    setCrossGeometry(
      this.whiteCenter.geometry,
      cx + 0.5,
      cy + 0.5,
      CENTER_ARM_LEN,
      CENTER_HALF_WIDTH,
    );
  }

  hide() {
    this.visible = false;
  }
}
