import { makeVar, useReactiveVar } from "../../hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/autoSelect.ts";
import { UnitDataAction } from "../../../../shared/types.ts";
import { unitData } from "../../../../shared/data.ts";
import { getLocalPlayer } from "../../vars/players.ts";
import { shortcutsVar } from "../Settings.tsx";
import { SvgIcon } from "../../components/SVGIcon.tsx";
import { useTooltip } from "../../hooks/useTooltip.tsx";

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
  { name, icon, iconType, binding, iconScale }: {
    name: string;
    icon?: string;
    iconType?: "svg";
    binding?: string[];
    iconScale?: number;
  },
) => {
  const { tooltipContainerProps, tooltip } = useTooltip(name);

  const handleClick = () => {
    if (!binding?.length) return;

    for (const code of binding) {
      const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }

    for (const code of binding.toReversed()) {
      const event = new KeyboardEvent("keyup", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }
  };

  return (
    <div
      className="command"
      onClick={handleClick}
      {...tooltipContainerProps}
    >
      {iconType === "svg" && icon && (
        <SvgIcon
          icon={icon}
          color={getLocalPlayer()?.color}
          scale={iconScale}
        />
      )}
      {binding?.length && (
        <div>{binding.map((b) => b.replace("Key", "")).join("")}</div>
      )}
      {tooltip}
    </div>
  );
};

const iconMap: Record<string, string> = {
  destroyLastFarm: "collision",
  hold: "suspend",
};

const Action = ({ action }: { action: UnitDataAction }) => {
  if (action.type === "build") {
    return (
      <Command
        name={action.name}
        iconType="svg"
        icon={unitData[action.unitType]?.model ?? action.unitType}
        iconScale={unitData[action.unitType]?.modelScale}
        binding={action.binding}
      />
    );
  }

  if (action.type === "auto") {
    return (
      <Command
        name={action.name}
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
