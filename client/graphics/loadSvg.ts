import {
  Box3,
  BufferGeometry,
  ColorRepresentation,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  Vector3,
  WebGLProgramParametersWithUniforms,
} from "three";
import { SVGLoader } from "three/SVGLoader";
import { InstancedGroup } from "./InstancedGroup.ts";
import { scene } from "./three.ts";
import { svgs } from "../systems/three.ts";
import { memoize } from "@/shared/pathing/memoize.ts";

const loader = new SVGLoader();
let zOrderCounter = 0;

const addInstanceAlpha = (shader: WebGLProgramParametersWithUniforms) => {
  // 1) Declare our attributes & varyings
  shader.vertexShader = "attribute float instanceAlpha;\n" +
    "attribute float instanceMinimapMask;\n" +
    "varying float vInstanceAlpha;\n" +
    "varying float vInstanceMinimapMask;\n" +
    shader.vertexShader;

  // 2) Pass them through in the vertex stage
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    "void main() {\n" +
      "  vInstanceAlpha = instanceAlpha;\n" +
      "  vInstanceMinimapMask = instanceMinimapMask;",
  );

  shader.fragmentShader = "varying float vInstanceAlpha;\n" +
    "varying float vInstanceMinimapMask;\n" +
    shader.fragmentShader;

  // 3) In minimap mask mode, use vColor (from instanceColor) for solid player color silhouette
  shader.fragmentShader = shader.fragmentShader.replace(
    /vec4 diffuseColor = vec4\( diffuse, opacity \);/,
    `float finalOpacity = vInstanceMinimapMask > 0.5 ? vInstanceAlpha : opacity * vInstanceAlpha;
    #ifdef USE_INSTANCING_COLOR
      vec3 final = vInstanceMinimapMask > 0.5 ? vColor : diffuse;
    #else
      vec3 final = diffuse;
    #endif
    vec4 diffuseColor = vec4( final, finalOpacity );`,
  );
};

const getMaterial = memoize((
  color: ColorRepresentation | undefined,
  opacity: number | undefined,
  player: boolean,
) => {
  const material = new MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
    forceSinglePass: true,
    userData: { player },
  });
  material.customProgramCacheKey = () => "instanceAlpha";
  material.onBeforeCompile = addInstanceAlpha;

  return material;
});

export const loadSvg = (
  svg: string,
  scale: number,
  { count = 0, layer, yOffset = 0, xOffset = 0, facingOffset }: {
    count?: number;
    layer?: number;
    yOffset?: number;
    xOffset?: number;
    facingOffset?: number;
  } = {},
  zOrder?: number,
) => {
  const name = Object.entries(svgs).find((e) => e[1] === svg)?.[0];
  scale /= 36 * 2; // SVGs are 36x36, and we want a sheep to be size 1

  const data = loader.parse(svg);

  // Create geometry
  const group = new Group();
  let renderOrder = 0;
  for (const path of data.paths) {
    const fillColor = path.userData?.style.fill;

    if (fillColor !== undefined && fillColor !== "none") {
      const opacity = path.userData?.style.opacity ??
        path.userData?.style.fillOpacity ?? 1;

      const material = getMaterial(
        path.color.getHex(),
        opacity,
        "player" in path.userData?.node.dataset,
      );

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

  if (facingOffset) {
    for (const c of group.children) {
      if (c instanceof Mesh && c.geometry instanceof BufferGeometry) {
        c.geometry.rotateZ(facingOffset);
      }
    }
  }

  // Center geometry with optional X and Y offsets
  const offset = new Vector3();
  new Box3().setFromObject(group)
    .clone()
    .getCenter(offset)
    .multiplyScalar(-1);

  // Apply yOffset and xOffset to shift the geometry
  offset.y += yOffset;
  offset.x += xOffset;

  for (const c of group.children) {
    if (c instanceof Mesh && c.geometry instanceof BufferGeometry) {
      c.geometry.translate(offset.x, offset.y, 0);
    }
  }

  // Make instanced
  // Dynamic map utilization check will skip bounds recalc when mesh covers >80% of map
  const igroup = new InstancedGroup(group, count, name);
  if (typeof layer === "number") igroup.traverse((o) => o.layers.set(layer));

  // Apply render order (use provided zOrder or auto-increment)
  const currentZOrder = zOrder ?? zOrderCounter++;
  igroup.traverse((o) => {
    if ("renderOrder" in o) o.renderOrder = currentZOrder;
  });

  scene.add(igroup);
  return igroup;
};
