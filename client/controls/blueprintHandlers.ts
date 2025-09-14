import { app, Entity, SystemEntity } from "../ecs.ts";
import { prefabs } from "@/shared/data.ts";
import { getLocalPlayer, getPlayer } from "../ui/vars/players.ts";
import { selection } from "../systems/autoSelect.ts";
import { canBuild } from "../api/unit.ts";
import { updateCursor } from "../graphics/cursor.ts";
import { setFind } from "../../server/util/set.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";
import { queued } from "./orderHandlers.ts";
import { editorVar } from "@/vars/editor.ts";

let blueprintIndex = 0;
let blueprint: SystemEntity<"prefab"> | undefined;

export const normalize = (
  value: number,
  mode: "half" | "offset-half" | "offset-full",
) => {
  switch (mode) {
    case "half": // 0, 0.5, 1, 1.5 ...
      return Math.round(value / 0.5) * 0.5;

    case "offset-half": // 0.25, 0.75, 1.25 ...
      return (Math.round(value / 0.5 + 0.5) - 0.5) * 0.5;

    case "offset-full": // -0.5, 0.5, 1.5, ...
      return Math.round(value - 0.5) + 0.5;

    default:
      return value;
  }
};

export const normalizeBuildPosition = (
  x: number,
  y: number,
  unitType: string,
) => [
  prefabs[unitType]?.tilemap
    ? normalize(
      x,
      unitType === "tile"
        ? "offset-full"
        : ((prefabs[unitType]?.tilemap?.width ?? 0) % 4 === 0
          ? "half"
          : "offset-half"),
    )
    : x,
  prefabs[unitType]?.tilemap
    ? normalize(
      y,
      unitType === "tile"
        ? "offset-full"
        : ((prefabs[unitType]?.tilemap?.width ?? 0) % 4 === 0
          ? "half"
          : "offset-half"),
    )
    : y,
];

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

export const createBlueprint = (prefab: string, x: number, y: number) => {
  const builder: Entity | undefined =
    Array.from(selection).find((u) =>
      u.actions?.some((a) => a.type === "build" && a.unitType === prefab)
    ) ?? (editorVar() ? { id: "editor" } : undefined);

  if (!builder) return;

  const [normalizedX, normalizedY] = normalizeBuildPosition(x, y, prefab);

  const owner = builder.owner ? getPlayer(builder.owner) : undefined;
  const playerColor = owner?.color;
  const targetColor = canBuild(builder, prefab, normalizedX, normalizedY)
    ? 0x0000ff
    : 0xff0000;

  if (blueprint) app.removeEntity(blueprint);

  blueprint = app.addEntity({
    id: `blueprint-${blueprintIndex++}`,
    prefab: prefab,
    position: { x: normalizedX, y: normalizedY },
    owner: owner?.id,
    model: prefabs[prefab]?.model,
    modelScale: prefabs[prefab]?.modelScale,
    isDoodad: true,
    ...(owner &&
      {
        vertexColor: playerColor
          ? computeBlueprintColor(playerColor, targetColor)
          : targetColor,
        alpha: 0.75,
      }),
  });
  updateCursor();
  return blueprint;
};

export const updateBlueprint = (x: number, y: number) => {
  if (!blueprint) return;

  const builder: Entity | undefined = getBuilderFromBlueprint() ??
    (editorVar() ? { id: "editor" } : undefined);
  if (!builder) return;

  const [normalizedX, normalizedY] = normalizeBuildPosition(
    x,
    y,
    blueprint.prefab,
  );

  blueprint.position = { x: normalizedX, y: normalizedY };

  const localPlayer = getLocalPlayer();
  const playerColor = localPlayer?.color;
  const targetColor =
    canBuild(builder, blueprint.prefab, normalizedX, normalizedY)
      ? 0x0000ff
      : 0xff0000;

  if (blueprint.owner) {
    blueprint.vertexColor = playerColor
      ? computeBlueprintColor(playerColor, targetColor)
      : targetColor;
  }
};

export const cancelBlueprint = () => {
  queued.state = false;
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
