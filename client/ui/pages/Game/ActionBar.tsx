import { makeVar, useReactiveVar } from "../../hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/autoSelect.ts";
import { UnitDataAction } from "../../../../shared/types.ts";
import { unitData } from "../../../../shared/data.ts";
import { svgs } from "../../../systems/three.ts";
import { getLocalPlayer } from "../../vars/players.ts";
import { shortcutsVar } from "../Settings.tsx";

export const selectionVar = makeVar<Entity | undefined>(undefined);
selection.addEventListener(
  "add",
  (e) => selectionVar((v) => v?.selected && app.entities.has(v) ? v : e),
);
selection.addEventListener(
  "delete",
  (e) =>
    selectionVar((v) =>
      v !== e && v?.selected && app.entities.has(v) ? v : selection.first()
    ),
);

const Command = (
  { icon, iconType, binding, iconScale }: {
    icon?: string;
    iconType?: "svg";
    binding?: string[];
    iconScale?: number;
  },
) => (
  <div
    className="command"
    onClick={() => {
      if (!binding?.length) return;
      const event = new KeyboardEvent("keydown", {
        code: binding[0],
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }}
  >
    {iconType === "svg" && icon && (
      <div
        style={{
          color: getLocalPlayer()?.color,
          transform: iconScale ? `scale(${iconScale})` : undefined,
        }}
        dangerouslySetInnerHTML={{
          __html: icon,
        }}
      >
      </div>
    )}
    {binding?.length && (
      <div>{binding.map((b) => b.replace("Key", "")).join("")}</div>
    )}
  </div>
);

const iconMap: Record<string, string> = {
  destroyLastFarm: svgs.collision,
  hold: svgs.suspend,
};

const Action = ({ action }: { action: UnitDataAction }) => {
  if (action.type === "build") {
    return (
      <Command
        iconType="svg"
        icon={svgs[
          unitData[action.unitType]?.model ?? action.unitType
        ]}
        iconScale={unitData[action.unitType]?.modelScale}
        binding={action.binding}
      />
    );
  }

  if (action.type === "auto") {
    return (
      <Command
        iconType="svg"
        icon={iconMap[action.order]}
        binding={action.binding}
      />
    );
  }

  return null;
};

export const ActionBar = () => {
  const selection = useReactiveVar(selectionVar);
  useReactiveVar(shortcutsVar);

  return (
    <div
      className="card h-stack hide-empty"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        gap: 10,
        padding: 12,
      }}
    >
      {selection?.actions?.map((a, i) => <Action key={i} action={a} />)}
    </div>
  );
};
