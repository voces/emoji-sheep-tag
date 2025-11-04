import { Entity } from "../../../ecs.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { items, prefabs } from "@/shared/data.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Command } from "./Command.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { getPlayer } from "@/shared/api/player.ts";

export const Action = ({ action, current, entity }: {
  action: UnitDataAction & { count?: number };
  current: boolean;
  entity: Entity;
}) => {
  // Check if action is disabled due to insufficient mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  let disabled = manaCost > 0 && (entity.mana ?? 0) < manaCost;

  const owningPlayer = getPlayer(entity.owner);

  // Check if action is disabled due to insufficient gold
  if (action.goldCost) {
    const goldCost = action.goldCost;
    // Find the owning player of the entity
    const playerGold = owningPlayer?.gold ?? 0;
    disabled = disabled || (goldCost > 0 && playerGold < goldCost);
  }

  // Check if action is disabled during construction
  const isConstructing = typeof entity.progress === "number";
  const canExecuteWhileConstructing = "canExecuteWhileConstructing" in action &&
    action.canExecuteWhileConstructing === true;
  if (isConstructing && !canExecuteWhileConstructing) {
    disabled = true;
  }

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
