import "@/client-testing/setup.ts";
import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { addEntity } from "@/shared/api/entity.ts";
import { fakeRenderer } from "@/client-testing/fakeRenderer.ts";
import { type Entity, listen } from "../../../ecs.ts";
import { collections } from "../../../systems/models.ts";
import { createMinimapRenderer } from "./rendering.ts";

const indexOf = (entity: Entity) => {
  const collection = collections[entity.prefab!]!;
  for (let i = 0; i < collection.getCount(); i++) {
    if (collection.getId(i) === entity.id) return i;
  }
  throw new Error(`${entity.id} has no instance`);
};

const scaleOf = (entity: Entity) => {
  const matrix = new Matrix4();
  collections[entity.prefab!]!.getMatrixAt(indexOf(entity), matrix);
  return new Vector3().setFromMatrixScale(matrix).x;
};

const alphaOf = (entity: Entity) =>
  collections[entity.prefab!]!.geometry.getAttribute("instanceAlpha")
    .getX(indexOf(entity));

const minimapOf = (
  units: Entity[],
  playerEntities: Entity[],
  onDraw: () => void,
) =>
  createMinimapRenderer(
    fakeRenderer({ onDraw }).renderer,
    new PerspectiveCamera(),
    new Scene(),
    new Set(units),
    new Set(playerEntities),
    1,
  );

it("draws units larger on the minimap without changing the entities", () => {
  const sheep = addEntity({
    id: "minimap-sheep",
    prefab: "sheep",
    owner: "player-0",
    position: { x: 10, y: 10 },
  });
  const changes: string[] = [];
  listen(sheep, ["modelScale", "alpha"], (_, prev) => changes.push(`${prev}`));
  const scaleWhileDrawn: number[] = [];
  const minimap = minimapOf(
    [sheep],
    [],
    () => scaleWhileDrawn.push(scaleOf(sheep)),
  );
  const scale = scaleOf(sheep);

  minimap.renderScene();

  expect(scaleWhileDrawn).toEqual([scale * 5]);
  expect(scaleOf(sheep)).toBe(scale);
  expect(changes).toEqual([]);
  expect(sheep.modelScale).toBeUndefined();
  minimap.dispose();
});

it("draws faded structures more solid on the minimap without changing them", () => {
  const hut = addEntity({
    id: "minimap-hut",
    prefab: "hut",
    owner: "player-0",
    position: { x: 20, y: 20 },
    alpha: 0.2,
  });
  const changes: string[] = [];
  listen(hut, ["modelScale", "alpha"], (_, prev) => changes.push(`${prev}`));
  const alphaWhileDrawn: number[] = [];
  const minimap = minimapOf(
    [],
    [hut],
    () => alphaWhileDrawn.push(alphaOf(hut)),
  );

  minimap.renderScene();

  expect(alphaWhileDrawn.map((a) => a.toFixed(2))).toEqual(["0.80"]);
  expect(alphaOf(hut)).toBeCloseTo(0.2);
  expect(changes).toEqual([]);
  minimap.dispose();
});
