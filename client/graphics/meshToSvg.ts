import * as THREE from "three";

export interface SvgOptions {
  scale?: number;
  viewBox?: { x: number; y: number; width: number; height: number };
  strokeWidth?: number;
  strokeColor?: string;
  showWalls?: boolean;
  showGround?: boolean;
}

export const meshToSvg = (
  mesh: THREE.Mesh,
  options: SvgOptions = {},
): string => {
  const scale = options.scale ?? 100;
  const strokeWidth = options.strokeWidth ?? 0;
  const strokeColor = options.strokeColor ?? "none";
  const showWalls = options.showWalls ?? false;
  const showGround = options.showGround ?? true;

  const positions = mesh.geometry.getAttribute("position");
  const colors = mesh.geometry.getAttribute("color");
  const indices = mesh.geometry.index!;

  // Group triangles by Z-layer
  const groundTriangles: string[] = [];
  const wallTriangles: string[] = [];

  // Process each triangle
  for (let i = 0; i < indices.count; i += 3) {
    const i0 = indices.getX(i);
    const i1 = indices.getX(i + 1);
    const i2 = indices.getX(i + 2);

    // Get vertex positions
    const v0 = {
      x: positions.getX(i0) * scale,
      y: positions.getY(i0) * scale,
      z: positions.getZ(i0),
    };
    const v1 = {
      x: positions.getX(i1) * scale,
      y: positions.getY(i1) * scale,
      z: positions.getZ(i1),
    };
    const v2 = {
      x: positions.getX(i2) * scale,
      y: positions.getY(i2) * scale,
      z: positions.getZ(i2),
    };

    // Average color for the triangle
    const r = Math.round(
      (colors.getX(i0) + colors.getX(i1) + colors.getX(i2)) / 3 * 255,
    );
    const g = Math.round(
      (colors.getY(i0) + colors.getY(i1) + colors.getY(i2)) / 3 * 255,
    );
    const b = Math.round(
      (colors.getZ(i0) + colors.getZ(i1) + colors.getZ(i2)) / 3 * 255,
    );
    const fillColor = `rgb(${r},${g},${b})`;

    // Create SVG polygon
    const points = `${v0.x},${v0.y} ${v1.x},${v1.y} ${v2.x},${v2.y}`;
    const polygon = strokeWidth > 0
      ? `<polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      : `<polygon points="${points}" fill="${fillColor}"/>`;

    // Sort by Z layer
    const avgZ = (v0.z + v1.z + v2.z) / 3;
    if (avgZ < 0.0005) {
      groundTriangles.push(polygon);
    } else {
      wallTriangles.push(polygon);
    }
  }

  // Calculate viewBox if not provided
  const viewBox = options.viewBox ?? (() => {
    const bbox = mesh.geometry.boundingBox!;
    return {
      x: bbox.min.x * scale - 10,
      y: bbox.min.y * scale - 10,
      width: (bbox.max.x - bbox.min.x) * scale + 20,
      height: (bbox.max.y - bbox.min.y) * scale + 20,
    };
  })();

  // Build SVG
  const svgContent: string[] = [];
  svgContent.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">`,
  );

  // Add background
  svgContent.push(
    `<rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="white"/>`,
  );

  // Add ground layer
  if (showGround) {
    svgContent.push(`<g id="ground">`);
    svgContent.push(...groundTriangles);
    svgContent.push(`</g>`);
  }

  // Add wall layer on top
  if (showWalls) {
    svgContent.push(`<g id="walls">`);
    svgContent.push(...wallTriangles);
    svgContent.push(`</g>`);
  }

  svgContent.push(`</svg>`);

  return svgContent.join("\n");
};

export const saveSvgToFile = async (svg: string, filepath: string) => {
  await Deno.writeTextFile(filepath, svg);
};
