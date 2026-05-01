import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from "three";
import type { EditorTerrainClipboard } from "@/vars/editor.ts";

const setRectLineGeometry = (
  geo: BufferGeometry,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) => {
  // 4 line segments forming the rectangle.
  const verts = new Float32Array([
    minX,
    minY,
    0,
    maxX,
    minY,
    0,
    maxX,
    minY,
    0,
    maxX,
    maxY,
    0,
    maxX,
    maxY,
    0,
    minX,
    maxY,
    0,
    minX,
    maxY,
    0,
    minX,
    minY,
    0,
  ]);
  geo.setAttribute("position", new BufferAttribute(verts, 3));
  geo.computeBoundingSphere();
};

const writeQuad = (
  out: Float32Array,
  byteOffset: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const o = byteOffset;
  out[o] = x1;
  out[o + 1] = y1;
  out[o + 2] = 0;
  out[o + 3] = x2;
  out[o + 4] = y1;
  out[o + 5] = 0;
  out[o + 6] = x2;
  out[o + 7] = y2;
  out[o + 8] = 0;
  out[o + 9] = x1;
  out[o + 10] = y1;
  out[o + 11] = 0;
  out[o + 12] = x2;
  out[o + 13] = y2;
  out[o + 14] = 0;
  out[o + 15] = x1;
  out[o + 16] = y2;
  out[o + 17] = 0;
};

/**
 * Persistent rectangular selection outline + optional clipboard "stamp"
 * preview drawn underneath the cursor. Both layers are off by default; turn
 * them on via setSelection / setStamp.
 */
export class SelectionOverlay extends Group {
  private blackOutline: LineSegments;
  private whiteOutline: LineSegments;
  private stampMesh: Mesh;
  private stampGeometry: BufferGeometry;
  private hasStampGeometry = false;
  private stampVertexColors: Float32Array | undefined;

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

    this.blackOutline = new LineSegments(
      new BufferGeometry(),
      lineMat(0x000000, 0.95),
    );
    this.whiteOutline = new LineSegments(
      new BufferGeometry(),
      lineMat(0xffffff, 1),
    );
    this.stampGeometry = new BufferGeometry();
    this.stampMesh = new Mesh(
      this.stampGeometry,
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        depthTest: false,
      }),
    );

    const layers: Array<[Object3D, number, number]> = [
      [this.stampMesh, 0.001, 9998],
      [this.blackOutline, 0.002, 9999],
      [this.whiteOutline, 0.003, 10000],
    ];
    for (const [obj, z, order] of layers) {
      obj.position.z = z;
      obj.renderOrder = order;
      obj.frustumCulled = false;
      obj.visible = false;
      obj.raycast = () => {};
      this.add(obj);
    }
  }

  /**
   * Show the selection rectangle covering world cells [minX..maxX] × [minY..maxY]
   * (inclusive). Pass undefined to hide it.
   */
  setSelection(
    rect:
      | { minX: number; minY: number; maxX: number; maxY: number }
      | undefined,
  ) {
    if (!rect) {
      this.blackOutline.visible = false;
      this.whiteOutline.visible = false;
      this.updateGroupVisibility();
      return;
    }
    setRectLineGeometry(
      this.blackOutline.geometry,
      rect.minX,
      rect.minY,
      rect.maxX + 1,
      rect.maxY + 1,
    );
    setRectLineGeometry(
      this.whiteOutline.geometry,
      rect.minX,
      rect.minY,
      rect.maxX + 1,
      rect.maxY + 1,
    );
    this.blackOutline.visible = true;
    this.whiteOutline.visible = true;
    this.updateGroupVisibility();
  }

  /**
   * Show a clipboard stamp anchored with its bottom-left at (originX, originY).
   * Cells are colored by tileColors so the user sees what will be pasted.
   * Pass undefined to hide it.
   */
  setStamp(
    clipboard: EditorTerrainClipboard | undefined,
    originX: number,
    originY: number,
    tileColors: ReadonlyArray<number>,
  ) {
    if (!clipboard) {
      this.stampMesh.visible = false;
      this.updateGroupVisibility();
      return;
    }

    const cellCount = clipboard.width * clipboard.height;
    if (
      !this.hasStampGeometry ||
      !this.stampVertexColors ||
      this.stampVertexColors.length !== cellCount * 18
    ) {
      const positions = new Float32Array(cellCount * 18);
      this.stampVertexColors = new Float32Array(cellCount * 18);
      this.stampGeometry.setAttribute(
        "position",
        new BufferAttribute(positions, 3),
      );
      this.stampGeometry.setAttribute(
        "color",
        new BufferAttribute(this.stampVertexColors, 3),
      );
      this.hasStampGeometry = true;
    }
    const positions = this.stampGeometry.attributes.position
      .array as Float32Array;
    const colors = this.stampVertexColors;
    const cliffColor = new Color(0xb39c80);
    const waterColor = new Color(0x385670);
    const tmp = new Color();

    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const i = y * clipboard.width + x;
        const wx = originX + x;
        const wy = originY + y;
        writeQuad(positions, i * 18, wx, wy, wx + 1, wy + 1);

        const water = clipboard.water[y]?.[x] ?? 0;
        const cliff = clipboard.cliffs[y]?.[x];
        const tileIndex = clipboard.tiles[y]?.[x] ?? 0;
        let baseColor: Color;
        if (water > 0) baseColor = waterColor;
        else if (typeof cliff === "number" && cliff > 0) baseColor = cliffColor;
        else {
          tmp.setHex(tileColors[tileIndex] ?? 0xffffff);
          baseColor = tmp;
        }
        for (let v = 0; v < 6; v++) {
          const o = i * 18 + v * 3;
          colors[o] = baseColor.r;
          colors[o + 1] = baseColor.g;
          colors[o + 2] = baseColor.b;
        }
      }
    }
    this.stampGeometry.attributes.position.needsUpdate = true;
    this.stampGeometry.attributes.color.needsUpdate = true;
    this.stampGeometry.computeBoundingSphere();
    this.stampMesh.visible = true;
    this.updateGroupVisibility();
  }

  private updateGroupVisibility() {
    this.visible = this.blackOutline.visible || this.stampMesh.visible;
  }
}
