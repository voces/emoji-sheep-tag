import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { lobbyContext } from "../contexts.ts";
import { appContext } from "@/shared/context.ts";
import { newEcs } from "../ecs.ts";
import { type LoadedMap, setMapForApp } from "@/shared/map.ts";
import { END_TILE, PEN_TILE, START_TILE } from "@/shared/maps/tags.ts";
import { clearPenAreasCache } from "@/shared/penAreas.ts";
import { clampToSheepSpawnArea, isInSheepSpawnArea } from "./getSheepSpawn.ts";

const buildMap = (tiles: number[][]): LoadedMap => {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  return {
    id: `test-${Math.random()}`,
    name: "test",
    bounds: { min: { x: 0, y: 0 }, max: { x: width, y: height } },
    center: { x: width / 2, y: height / 2 },
    tiles,
    cliffs: tiles.map((row) => row.map(() => 0 as number | "r")),
    water: tiles.map((row) => row.map(() => 0)),
    mask: [],
    terrainPathingMap: tiles.map((row) => row.map(() => 0)),
    terrainLayers: tiles.map((row) => row.map(() => 0)),
    width,
    height,
    entities: [],
    tags: [],
  };
};

const G = 0;
const P = PEN_TILE;
const S = START_TILE;
const E = END_TILE;

const setupLobby = (mode: "survival" | "bulldog") => {
  // deno-lint-ignore no-explicit-any
  const lobby = { settings: { mode } } as any;
  lobbyContext.current = lobby;
};

const useMap = (tiles: number[][]) => {
  const ecs = newEcs();
  appContext.current = ecs;
  setMapForApp(ecs, buildMap(tiles));
  clearPenAreasCache();
};

afterEach(() => {
  lobbyContext.current = undefined;
  appContext.current = undefined;
  clearPenAreasCache();
});

describe("isInSheepSpawnArea — bulldog", () => {
  beforeEach(() => {
    setupLobby("bulldog");
    // 4-row map, with a 2x2 start area at columns 2-3 of rows 1-2.
    // tile array: row 0 = world y = 3 (top), row 3 = world y = 0 (bottom)
    useMap([
      [G, G, G, G, G],
      [G, G, S, S, G],
      [G, G, S, S, G],
      [G, G, G, G, G],
    ]);
  });

  it("accepts points strictly inside a start tile", () => {
    // Tile array col=2, row=1 → world (2..3, 2..3)
    expect(isInSheepSpawnArea(2.5, 2.5)).toBe(true);
    // Tile array col=3, row=2 → world (3..4, 1..2)
    expect(isInSheepSpawnArea(3.5, 1.5)).toBe(true);
  });

  it("rejects points just outside the start area", () => {
    // Just left of the start area
    expect(isInSheepSpawnArea(1.5, 2.5)).toBe(false);
    // Just below the start area
    expect(isInSheepSpawnArea(2.5, 0.5)).toBe(false);
  });
});

describe("clampToSheepSpawnArea — bulldog", () => {
  beforeEach(() => {
    setupLobby("bulldog");
    useMap([
      [G, G, G, G, G],
      [G, G, S, S, G],
      [G, G, S, S, G],
      [G, G, G, G, G],
    ]);
  });

  it("returns the input when already inside a start tile", () => {
    expect(clampToSheepSpawnArea(2.5, 2.5)).toEqual({ x: 2.5, y: 2.5 });
  });

  it("snaps to the nearest start tile edge when outside", () => {
    // Far left of start area at world x=0, y=2.5 → nearest start cell edge x=2
    const { x, y } = clampToSheepSpawnArea(0, 2.5);
    expect(x).toBe(2);
    expect(y).toBe(2.5);
  });

  it("does not push out of any interior (no End interaction)", () => {
    // Add an end tile inside; clamp should still permit start tile interiors.
    useMap([
      [G, G, G, G, G],
      [G, G, S, S, G],
      [G, G, S, S, G],
      [G, G, E, E, G],
    ]);
    expect(clampToSheepSpawnArea(2.5, 2.5)).toEqual({ x: 2.5, y: 2.5 });
  });
});

describe("isInSheepSpawnArea — survival", () => {
  beforeEach(() => {
    setupLobby("survival");
    // 8x8 with a 2x2 pen at world (3..5, 3..5).
    // Tile rows top→bottom; world y = (rows - 1) - rowIdx.
    // We want pen tiles where world y in {3, 4} → row indices {4, 3}.
    const row = (vals: number[]) => vals;
    const tiles: number[][] = [];
    for (let i = 0; i < 8; i++) {
      const r: number[] = [];
      for (let j = 0; j < 8; j++) r.push(G);
      tiles.push(r);
    }
    // world y=3 → row idx 4; world y=4 → row idx 3
    tiles[3][3] = P;
    tiles[3][4] = P;
    tiles[4][3] = P;
    tiles[4][4] = P;
    void row;
    useMap(tiles);
  });

  it("accepts points in the strip outside the pen", () => {
    // Just outside the pen on the left: pen.x = 3, MAX_DISTANCE = 1.5 → x in (1.5, 3) outside pen, y in pen y range
    expect(isInSheepSpawnArea(2.5, 4)).toBe(true);
  });

  it("rejects points inside the pen interior", () => {
    expect(isInSheepSpawnArea(4, 4)).toBe(false);
  });

  it("rejects points beyond the expanded pen rectangle", () => {
    expect(isInSheepSpawnArea(0, 4)).toBe(false);
    expect(isInSheepSpawnArea(7, 4)).toBe(false);
  });
});

describe("clampToSheepSpawnArea — survival", () => {
  beforeEach(() => {
    setupLobby("survival");
    const tiles: number[][] = [];
    for (let i = 0; i < 8; i++) {
      const r: number[] = [];
      for (let j = 0; j < 8; j++) r.push(G);
      tiles.push(r);
    }
    tiles[3][3] = P;
    tiles[3][4] = P;
    tiles[4][3] = P;
    tiles[4][4] = P;
    useMap(tiles);
  });

  it("clamps to the expanded pen rectangle on the outside", () => {
    // Far left, expanded pen.x = 3 - 1.5 = 1.5, y row 4
    const { x, y } = clampToSheepSpawnArea(0, 4);
    expect(x).toBe(1.5);
    expect(y).toBe(4);
  });

  it("pushes out of the pen interior toward the nearest edge", () => {
    // Inside pen at (4, 4), pen spans (3..5, 3..5). Distances: left=1, right=1, bottom=1, top=1.
    // Implementation picks "left" first when ties. Either edge with MIN_DISTANCE_FROM_PEN=1 is fine; just check it ended up on the strip.
    const { x, y } = clampToSheepSpawnArea(4, 4);
    expect(isInSheepSpawnArea(x, y)).toBe(true);
  });

  it("pushes out toward the closest pen edge", () => {
    // Inside pen near the right edge: (4.9, 4) → closest edge is right; push to x = 5 + 1
    const { x, y } = clampToSheepSpawnArea(4.9, 4);
    expect(x).toBe(6);
    expect(y).toBe(4);
  });
});
