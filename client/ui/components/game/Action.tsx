import { Entity } from "../../../ecs.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { items, prefabs } from "@/shared/data.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Command } from "./Command.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { getPlayer } from "@/shared/api/player.ts";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";

export const Action = ({ action, current, entity }: {
  action: UnitDataAction & { count?: number };
  current: boolean;
  entity: Entity;
}) => {
  // Check if action is disabled due to insufficient mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  const hasMana = useListenToEntityProps(
    entity,
    manaCost > 0 ? ["mana"] : [],
    ({ mana }) => (mana ?? 0) >= manaCost,
  );

  const owningPlayer = getPlayer(entity.owner);

  // Check if action is disabled due to insufficient gold
  const goldCost = action.goldCost ?? 0;
  const hasGold = useListenToEntityProps(
    owningPlayer,
    goldCost > 0 ? ["gold"] : [],
    ({ gold }) => (gold ?? 0) >= goldCost,
  );

  // Check if action is disabled during construction
  const blockedByConstructing = useListenToEntityProps(
    entity,
    "canExecuteWhileConstructing" in action &&
      action.canExecuteWhileConstructing === true
      ? []
      : ["progress"],
    ({ progress }) => typeof progress === "number",
  );

  const disabled = !hasMana || !hasGold || blockedByConstructing;

  switch (action.type) {
    case "auto":
    case "target":
      return (
        <Command
          name={action.name}
          description={action.description}
          icon={action.icon ?? action.order}
          binding={action.binding}
          pressed={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
          iconProps={action.iconEffect
            ? iconEffects[action.iconEffect](owningPlayer?.id)
            : undefined}
          count={action.count}
        />
      );
    case "build":
      return (
        <Command
          name={action.name}
          description={action.description}
          icon={action.icon ?? prefabs[action.unitType]?.model ??
            action.unitType}
          iconScale={prefabs[action.unitType]?.modelScale}
          binding={action.binding}
          pressed={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
          count={action.count}
        />
      );
    case "upgrade":
      return (
        <Command
          name={action.name}
          description={action.description}
          icon={action.icon ?? prefabs[action.prefab]?.model ??
            action.prefab}
          iconScale={prefabs[action.prefab]?.modelScale}
          binding={action.binding}
          pressed={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
          count={action.count}
        />
      );
    case "purchase":
      return (
        <Command
          name={action.name}
          description={action.description}
          icon={action.icon ?? items[action.itemId]?.icon ?? action.itemId}
          binding={action.binding}
          pressed={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
          count={action.count}
        />
      );
    case "menu":
      return (
        <Command
          name={action.name}
          description={action.description}
          icon={action.icon ?? "shop"}
          binding={action.binding}
          pressed={current}
          disabled={disabled}
          manaCost={manaCost}
          count={action.count}
        />
      );
    default:
      absurd(action);
  }

  return null;
};
