import {
  BufferAttribute,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";

const faceColorMaterial = new MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  side: DoubleSide,
  // flatShading: true,
});

export class ColorAttribute extends BufferAttribute {
  static COMPONENTS_PER_COLOR = 4;
  static VERTICES_PER_FACE = 3;
  static ITEM_SIZE = 4;

  private data: Float32Array;

  constructor(faces: number) {
    const data = new Float32Array(
      faces *
        ColorAttribute.COMPONENTS_PER_COLOR *
        ColorAttribute.VERTICES_PER_FACE,
    );

    super(data, ColorAttribute.ITEM_SIZE);

    this.data = data;
  }

  setFace(index: number, red: number, green: number, blue: number, alpha = 1) {
    const base = index *
      ColorAttribute.COMPONENTS_PER_COLOR *
      ColorAttribute.VERTICES_PER_FACE;

    for (let i = 0; i < ColorAttribute.VERTICES_PER_FACE; i++) {
      const offset = base + i * ColorAttribute.COMPONENTS_PER_COLOR;
      this.data[offset] = red;
      this.data[offset + 1] = green;
      this.data[offset + 2] = blue;
      this.data[offset + 3] = alpha;
    }

    this.needsUpdate = true;
  }

  getFace(
    index: number,
  ): [red: number, green: number, blue: number, alpha: number] {
    const base = index *
      ColorAttribute.COMPONENTS_PER_COLOR *
      ColorAttribute.VERTICES_PER_FACE * 2;

    return [
      this.data[base],
      this.data[base + 1],
      this.data[base + 2],
      this.data[base + 3],
    ];
  }
}

class SquareColorAttribute extends ColorAttribute {
  constructor(faces: number) {
    super(faces * 2);
  }

  setFaces(
    index: number,
    red: number,
    green: number,
    blue: number,
    alpha?: number,
  ) {
    super.setFace(index * 2, red, green, blue, alpha);
    super.setFace(index * 2 + 1, red, green, blue, alpha);
  }
}

class GridColorAttribute extends SquareColorAttribute {
  private width: number;

  constructor(width: number, height: number) {
    super(width * height);
    this.width = width;
  }

  setColor(
    x: number,
    y: number,
    red: number,
    green: number,
    blue: number,
    alpha?: number,
  ) {
    super.setFaces(y * this.width + x, red, green, blue, alpha);
  }

  getColor(x: number, y: number) {
    return super.getFace(y * this.width + x);
  }
}

export class Grid extends Mesh {
  private colors: GridColorAttribute;

  constructor(readonly width = 1, readonly height = 1) {
    const plane = new PlaneGeometry(
      width,
      height,
      width,
      height,
    ).toNonIndexed();

    const colors = new GridColorAttribute(width, height);
    plane.setAttribute("color", colors);

    super(plane, faceColorMaterial);

    this.colors = colors;
  }

  setColor(
    x: number,
    y: number,
    red: number,
    green: number,
    blue: number,
    alpha?: number,
  ): void {
    this.colors.setColor(x, y, red, green, blue, alpha);
  }

  getColor(x: number, y: number) {
    return this.colors.getColor(x, y);
  }
}
