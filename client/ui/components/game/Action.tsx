import { Entity } from "../../../ecs.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { items, prefabs } from "@/shared/data.ts";
import { playersVar } from "@/vars/players.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Command } from "./Command.tsx";

const iconMap: Record<string, string> = {
  destroyLastFarm: "collision",
  hold: "suspend",
  mirrorImage: "wolf",
  move: "route",
  stop: "stop",
  attack: "claw",
  selfDestruct: "collision",
  back: "stop",
  fox: "fox",
  speedPot: "purplePotion",
};

export const Action = ({ action, current, entity }: {
  action: UnitDataAction;
  current: boolean;
  entity: Entity;
}) => {
  // Check if action is disabled due to insufficient mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  let disabled = manaCost > 0 && (entity.mana ?? 0) < manaCost;

  // Check if action is disabled due to insufficient gold (for build and purchase actions)
  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    // Find the owning player of the entity
    const owningPlayer = playersVar().find((p) => p.id === entity.owner);
    const playerGold = owningPlayer?.entity?.gold ?? 0;
    disabled = disabled || (goldCost > 0 && playerGold < goldCost);
  }

  switch (action.type) {
    case "auto":
    case "target":
      return (
        <Command
          name={action.name}
          icon={iconMap[action.order] ?? action.order}
          binding={action.binding}
          current={current}
          disabled={disabled}
          manaCost={manaCost}
        />
      );
    case "build":
      return (
        <Command
          name={action.name}
          icon={prefabs[action.unitType]?.model ?? action.unitType}
          iconScale={prefabs[action.unitType]?.modelScale}
          binding={action.binding}
          current={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
        />
      );
    case "purchase":
      return (
        <Command
          name={action.name}
          icon={items[action.itemId]?.icon ?? action.itemId}
          binding={action.binding}
          current={current}
          disabled={disabled}
          goldCost={action.goldCost}
          manaCost={manaCost}
        />
      );
    case "menu":
      return (
        <Command
          name={action.name}
          icon="shop"
          binding={action.binding}
          current={current}
          disabled={disabled}
          manaCost={manaCost}
        />
      );
    default:
      absurd(action);
  }

  return null;
};
