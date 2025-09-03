import { app, SystemEntity } from "../ecs.ts";
import { prefabs } from "@/shared/data.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";
import { selection } from "../systems/autoSelect.ts";
import { canBuild } from "../api/unit.ts";
import { updateCursor } from "../graphics/cursor.ts";
import { setFind } from "../../server/util/set.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";

let blueprintIndex = 0;
let blueprint: SystemEntity<"prefab"> | undefined;

export const normalize = (value: number, evenStep: boolean) =>
  evenStep
    ? Math.round(value * 2) / 2
    : (Math.round(value * 2 + 0.5) - 0.5) / 2;

export const getBuilderFromBlueprint = () => {
  if (!blueprint) return;
  const unitType = blueprint.prefab;
  return setFind(
    selection,
    (u) =>
      u.actions?.some((a) => a.type === "build" && a.unitType === unitType) ??
        false,
  );
};

export const createBlueprint = (unitType: string, x: number, y: number) => {
  const builder = Array.from(selection).find((u) =>
    u.actions?.some((a) => a.type === "build" && a.unitType === unitType)
  );

  if (!builder) return;

  const normalizedX = normalize(
    x,
    (prefabs[unitType]?.tilemap?.width ?? 0) % 4 === 0,
  );
  const normalizedY = normalize(
    y,
    (prefabs[unitType]?.tilemap?.height ?? 0) % 4 === 0,
  );

  const localPlayer = getLocalPlayer();
  const playerColor = localPlayer?.color;
  const targetColor = canBuild(builder, unitType, normalizedX, normalizedY)
    ? 0x0000ff
    : 0xff0000;

  blueprint = app.addEntity({
    id: `blueprint-${blueprintIndex++}`,
    prefab: unitType,
    position: { x: normalizedX, y: normalizedY },
    owner: localPlayer?.id,
    model: prefabs[unitType]?.model,
    modelScale: prefabs[unitType]?.modelScale,
    vertexColor: playerColor
      ? computeBlueprintColor(playerColor, targetColor)
      : targetColor,
    alpha: 0.75,
  });
  updateCursor();
};

export const updateBlueprint = (x: number, y: number) => {
  if (!blueprint) return;

  const builder = getBuilderFromBlueprint();
  if (!builder) return;

  const normalizedX = normalize(
    x,
    (prefabs[blueprint.prefab]?.tilemap?.width ?? 0) % 4 === 0,
  );
  const normalizedY = normalize(
    y,
    (prefabs[blueprint.prefab]?.tilemap?.height ?? 0) % 4 === 0,
  );

  blueprint.position = { x: normalizedX, y: normalizedY };

  const localPlayer = getLocalPlayer();
  const playerColor = localPlayer?.color;
  const targetColor =
    canBuild(builder, blueprint.prefab, normalizedX, normalizedY)
      ? 0x0000ff
      : 0xff0000;

  blueprint.vertexColor = playerColor
    ? computeBlueprintColor(playerColor, targetColor)
    : targetColor;
};

export const cancelBlueprint = () => {
  if (blueprint) {
    app.removeEntity(blueprint);
    blueprint = undefined;
    updateCursor();
  }
};

export const clearBlueprint = (
  fn?: (blueprint: SystemEntity<"prefab">) => void,
) => {
  if (blueprint && (!fn || fn(blueprint))) cancelBlueprint();
};

export const hasBlueprint = () => !!blueprint;
export const getBlueprint = () => blueprint;
export const getBlueprintPrefab = () => blueprint?.prefab;
