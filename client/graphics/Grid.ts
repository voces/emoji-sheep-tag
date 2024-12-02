import { BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

const faceColorMaterial = new MeshBasicMaterial({
  vertexColors: true,
  // flatShading: true,
});

export class ColorAttribute extends BufferAttribute {
  static COMPONENTS_PER_COLOR = 3;
  static VERTICES_PER_FACE = 3;
  static ITEM_SIZE = 3;

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

  setFace(index: number, red: number, green: number, blue: number) {
    const base = index *
      ColorAttribute.COMPONENTS_PER_COLOR *
      ColorAttribute.VERTICES_PER_FACE;

    for (let i = 0; i < ColorAttribute.VERTICES_PER_FACE; i++) {
      this.data[base + i * ColorAttribute.VERTICES_PER_FACE] = red;
      this.data[base + i * ColorAttribute.VERTICES_PER_FACE + 1] = green;
      this.data[base + i * ColorAttribute.VERTICES_PER_FACE + 2] = blue;
    }

    this.needsUpdate = true;
  }
}

class SquareColorAttribute extends ColorAttribute {
  constructor(faces: number) {
    super(faces * 2);
  }

  setFaces(index: number, red: number, green: number, blue: number) {
    super.setFace(index * 2, red, green, blue);
    super.setFace(index * 2 + 1, red, green, blue);
  }
}

class GridColorAttribute extends SquareColorAttribute {
  private width: number;

  constructor(width: number, height: number) {
    super(width * height);
    this.width = width;
  }

  setColor(x: number, y: number, red: number, green: number, blue: number) {
    super.setFaces(y * this.width + x, red, green, blue);
  }
}

export class Grid extends Mesh {
  private colors: GridColorAttribute;

  constructor(width = 1, height = 1) {
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
  ): void {
    this.colors.setColor(x, y, red, green, blue);
  }
}
