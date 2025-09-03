import { Entity } from "../../../ecs.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { items, prefabs } from "@/shared/data.ts";
import { getPlayer } from "@/vars/players.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Command } from "./Command.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";

export const Action = ({ action, current, entity }: {
  action: UnitDataAction;
  current: boolean;
  entity: Entity;
}) => {
  // Check if action is disabled due to insufficient mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  let disabled = manaCost > 0 && (entity.mana ?? 0) < manaCost;

  const owningPlayer = entity.owner ? getPlayer(entity.owner) : undefined;

  // Check if action is disabled due to insufficient gold (for build and purchase actions)
  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    // Find the owning player of the entity
    const playerGold = owningPlayer?.entity?.gold ?? 0;
    disabled = disabled || (goldCost > 0 && playerGold < goldCost);
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
          manaCost={manaCost}
          iconProps={action.iconEffect
            ? iconEffects[action.iconEffect](owningPlayer?.id)
            : undefined}
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
        />
      );
    default:
      absurd(action);
  }

  return null;
};
