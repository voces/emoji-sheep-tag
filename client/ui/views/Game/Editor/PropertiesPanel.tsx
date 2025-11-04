import { VStack } from "@/components/layout/Layout.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { selection } from "../../../../systems/selection.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { InputField } from "@/components/forms/Input.tsx";
import { send } from "../../../../messaging.ts";
import { Entity } from "@/shared/types.ts";
import { SystemEntity } from "../../../../ecs.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { Panel } from "./common.ts";
import { deg2rad, rad2deg } from "@/shared/util/math.ts";

const change = (patch: Partial<Entity>) => {
  send({
    type: "editorUpdateEntities",
    entities: Array.from(selection, (e) => ({ id: e.id, ...patch })),
  });
};

const changePosition = (patch: Partial<NonNullable<Entity["position"]>>) => {
  send({
    type: "editorUpdateEntities",
    entities: Array.from(selection)
      .filter((e): e is SystemEntity<"selected" | "position"> => !!e.position)
      .map((e) => ({ id: e.id, position: { ...e.position, ...patch } })),
  });
};

export const PropertiesPanel = () => {
  useSet(selection);
  useListenToEntities(selection, [
    "name",
    "prefab",
    "vertexColor",
    "playerColor",
    "modelScale",
    "facing",
    "position",
  ]);

  if (!selection.size) return null;

  const names = new ExtendedSet(
    Array.from(selection, (e) => e.name ?? e.prefab),
  );

  const vertexColor = new ExtendedSet(
    Array.from(selection, (e) => e.vertexColor),
  );

  const playerColor = new ExtendedSet(
    Array.from(selection, (e) => e.playerColor),
  );

  const modelScale = new ExtendedSet(
    Array.from(selection, (e) => e.modelScale),
  );

  const facing = new ExtendedSet(
    Array.from(
      selection,
      (e) =>
        typeof e.facing === "number" ? Math.round(rad2deg(e.facing)) : e.facing,
    ),
  );

  const x = new ExtendedSet(
    Array.from(selection, (e) => e.position?.x),
  );

  const y = new ExtendedSet(
    Array.from(selection, (e) => e.position?.y),
  );

  const key = Array.from(selection, (e) => e.id).join("-");

  return (
    <Panel key={key}>
      {names.size && <h4>{names.size === 1 ? names.first() : "Mixed"}</h4>}
      <VStack>
        <InputField
          label="Vertex color"
          defaultValue={vertexColor.size === 1 ? vertexColor.first() ?? "" : ""}
          placeholder={vertexColor.size > 1 ? "mixed" : undefined}
          onChange={(e) =>
            change({ vertexColor: parseInt(e.currentTarget.value) ?? null })}
          onBlur={(e) =>
            e.currentTarget.value = `${
              vertexColor.size === 1 ? vertexColor.first() ?? "" : ""
            }`}
        />
        <InputField
          label="Player color"
          defaultValue={playerColor.size === 1 ? playerColor.first() ?? "" : ""}
          placeholder={playerColor.size > 1 ? "mixed" : undefined}
          onChange={(e) =>
            change({ playerColor: e.currentTarget.value || null })}
          onBlur={(e) =>
            e.currentTarget.value = `${
              playerColor.size === 1 ? playerColor.first() ?? "" : ""
            }`}
        />
        <InputField
          label="Scale"
          defaultValue={modelScale.size === 1 ? modelScale.first() ?? "" : ""}
          placeholder={modelScale.size > 1 ? "mixed" : undefined}
          onChange={(e) =>
            change({ modelScale: parseFloat(e.currentTarget.value) || null })}
          onBlur={(e) =>
            e.currentTarget.value = `${
              modelScale.size === 1 ? modelScale.first() ?? "" : ""
            }`}
        />
        <InputField
          label="Facing"
          defaultValue={facing.size === 1 ? facing.first() ?? "" : ""}
          placeholder={facing.size > 1 ? "mixed" : undefined}
          onChange={(e) => {
            const num = deg2rad(parseFloat(e.currentTarget.value) || 0);
            change({ facing: Number.isFinite(num) ? num : null });
          }}
          onBlur={(e) =>
            e.currentTarget.value = `${
              facing.size === 1 ? facing.first() ?? "" : ""
            }`}
        />
        <InputField
          label="X"
          defaultValue={x.size === 1 ? x.first() ?? "" : ""}
          placeholder={x.size > 1 ? "mixed" : undefined}
          onChange={(e) =>
            changePosition({ x: parseFloat(e.currentTarget.value) ?? 0 })}
          onBlur={(e) =>
            e.currentTarget.value = `${x.size === 1 ? x.first() ?? "" : ""}`}
        />
        <InputField
          label="Y"
          defaultValue={y.size === 1 ? y.first() ?? "" : ""}
          placeholder={y.size > 1 ? "mixed" : undefined}
          onChange={(e) =>
            changePosition({ y: parseFloat(e.currentTarget.value) ?? 0 })}
          onBlur={(e) =>
            e.currentTarget.value = `${y.size === 1 ? y.first() ?? "" : ""}`}
        />
      </VStack>
    </Panel>
  );
};
