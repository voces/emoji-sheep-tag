import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  Vector3,
} from "three";
//@deno-types="three/SVGLoader.d.ts"
import { SVGLoader } from "three/SVGLoader";
import { InstancedGroup } from "./InstancedGroup.ts";
import { scene } from "./three.ts";
import { svgs } from "../systems/three.ts";

const loader = new SVGLoader();

export const loadSvg = (
  svg: string,
  scale: number,
  { count = 0, layer }: {
    count?: number;
    layer?: number;
  } = {},
) => {
  const name = Object.entries(svgs).find((e) => e[1] === svg)?.[0];
  scale /= 36 * 2; // SVGs are 36x36, and we want a sheep to be size 1

  const data = loader.parse(svg.replace(/currentColor/g, "white"));

  // Create geometry
  const group = new Group();
  let renderOrder = 0;
  for (const path of data.paths) {
    const fillColor = path.userData?.style.fill;

    if (fillColor !== undefined && fillColor !== "none") {
      const material = new MeshBasicMaterial({
        color: path.color,
        opacity: path.userData?.style.fillOpacity,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        userData: { player: "player" in path.userData?.node.dataset },
      });
      material.onBeforeCompile = (shader) => {
        // 1) Declare our attribute & a varying
        shader.vertexShader = "attribute float instanceAlpha;\n" +
          "varying float vInstanceAlpha;\n" +
          shader.vertexShader;

        // 2) Pass it through in the vertex stage
        shader.vertexShader = shader.vertexShader.replace(
          "void main() {",
          "void main() {\n" +
            "  vInstanceAlpha = instanceAlpha;",
        );

        shader.fragmentShader = "varying float vInstanceAlpha;\n" +
          shader.fragmentShader;

        // 4) Multiply the built-in opacity by our per-instance alpha
        shader.fragmentShader = shader.fragmentShader.replace(
          /vec4 diffuseColor = vec4\( diffuse, opacity \);/,
          `vec4 diffuseColor = vec4( diffuse, opacity * vInstanceAlpha );`,
        );
      };

      const shapes = SVGLoader.createShapes(path);

      for (const shape of shapes) {
        const geometry = new ShapeGeometry(shape);
        geometry.scale(scale, -scale, scale);
        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = renderOrder++;

        group.add(mesh);
      }
    }
  }

  // Center geometry
  const offset = new Vector3();
  new Box3().setFromObject(group)
    .clone()
    .getCenter(offset)
    .multiplyScalar(-1);
  group.children.forEach((c) =>
    c instanceof Mesh && c.geometry instanceof BufferGeometry
      ? c.geometry.translate(offset.x, offset.y, 0)
      : null
  );

  // Make instanced
  const igroup = new InstancedGroup(group, count, name);
  if (typeof layer === "number") igroup.traverse((o) => o.layers.set(layer));
  scene.add(igroup);
  return igroup;
};
