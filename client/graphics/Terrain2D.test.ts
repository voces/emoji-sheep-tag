import { expect } from "@std/expect";
import { type CliffMask, Terrain2D } from "./Terrain2D.ts";
import { meshToSvg } from "./meshToSvg.ts";

const example1CliffMask: CliffMask = [
  [1, 1, 1],
  [1, "r", 1],
  [1, 2, 1],
  [1, 1, 1],
];

const example2CliffMask: CliffMask = [
  [1, 1, 1, 1],
  [1, "r", "r", 1],
  [1, 2, 2, 1],
  [1, 1, 1, 1],
];

const example3CliffMask: CliffMask = [
  [1, 1, 1, 1, 1],
  [1, 2, 2, 2, 1],
  [1, 2, 2, 2, 1],
  [1, 2, 2, 2, 1],
  [1, 1, 1, 1, 1],
];

const createTerrain = (cliffMask: CliffMask) =>
  new Terrain2D(
    {
      cliff: cliffMask,
      groundTile: cliffMask.map((r) => r.map(() => 0)),
      cliffTile: cliffMask.map((r) => r.map(() => 1)),
    },
    [
      { color: "#90ee90" },
      { color: "#ffdc41" },
    ],
  );

const normalizeSvg = (svg: string): string => {
  const lines = svg.split("\n").map((line) => line.trim());
  const polygons = lines
    .filter((line) => line.startsWith("<polygon"))
    .sort();

  return polygons.join("\n");
};

const generateSnapshot = (terrain: Terrain2D): string =>
  meshToSvg(terrain, {
    scale: 50,
    strokeWidth: 0.5,
    strokeColor: "black",
    showWalls: true,
    showGround: true,
  });

const saveSnapshot = async (svg: string, name: string) => {
  await Deno.writeTextFile(`./client/graphics/snapshots/${name}.svg`, svg);
};

const loadSnapshot = async (name: string): Promise<string | null> => {
  try {
    return await Deno.readTextFile(`./client/graphics/snapshots/${name}.svg`);
  } catch {
    return null;
  }
};

Deno.test("Terrain2D example 1 - single ramp", async () => {
  const terrain = createTerrain(example1CliffMask);
  const svg = generateSnapshot(terrain);

  const expectedSvg = await loadSnapshot("terrain2d_example1");
  if (!expectedSvg) {
    await Deno.mkdir("./client/graphics/snapshots", { recursive: true });
    await saveSnapshot(svg, "terrain2d_example1");
    console.log("Created snapshot: terrain2d_example1.svg");
  } else {
    expect(normalizeSvg(svg)).toEqual(normalizeSvg(expectedSvg));
  }
});

Deno.test("Terrain2D example 2 - two ramps", async () => {
  const terrain = createTerrain(example2CliffMask);
  const svg = generateSnapshot(terrain);

  const expectedSvg = await loadSnapshot("terrain2d_example2");
  if (!expectedSvg) {
    await Deno.mkdir("./client/graphics/snapshots", { recursive: true });
    await saveSnapshot(svg, "terrain2d_example2");
    console.log("Created snapshot: terrain2d_example2.svg");
  } else {
    expect(normalizeSvg(svg)).toEqual(normalizeSvg(expectedSvg));
  }
});

Deno.test("Terrain2D example 3 - large cliff area", async () => {
  const terrain = createTerrain(example3CliffMask);
  const svg = generateSnapshot(terrain);

  const expectedSvg = await loadSnapshot("terrain2d_example3");
  if (!expectedSvg) {
    await Deno.mkdir("./client/graphics/snapshots", { recursive: true });
    await saveSnapshot(svg, "terrain2d_example3");
    console.log("Created snapshot: terrain2d_example3.svg");
  } else {
    expect(normalizeSvg(svg)).toEqual(normalizeSvg(expectedSvg));
  }
});
