import { memo, useCallback } from "react";
import { Entity } from "../../../ecs.ts";
import { lookup } from "../../../systems/lookup.ts";
import { selection } from "../../../systems/selection.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { items, prefabs } from "@/shared/data.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { Command } from "./Command.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { getPlayer } from "@/shared/api/player.ts";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { getEffectivePlayerGold } from "../../../api/player.ts";
import { send } from "../../../client.ts";
import { playSound } from "../../../api/sound.ts";

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

export const Action = memo(({ action, current, entity }: {
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
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const ownerTeam = owningPlayer?.team === "wolf" ||
      owningPlayer?.team === "sheep"
    ? owningPlayer.team
    : undefined;
  const teamGoldEnabled = lobbySettings.mode === "vip" ||
    (lobbySettings.mode === "vamp" && ownerTeam === "wolf") ||
    (lobbySettings.mode === "survival" && lobbySettings.teamGold);

  // Get team entity for team gold checks
  const teamEntityId = ownerTeam ? TEAM_ENTITY_IDS[ownerTeam] : undefined;
  const teamEntity = teamEntityId ? lookup(teamEntityId) : undefined;

  // Check if action is disabled due to insufficient gold
  const goldCost = action.goldCost ?? 0;
  // Listen to gold changes to trigger rerenders, flooring to avoid unnecessary rerenders
  useListenToEntityProps(
    owningPlayer,
    goldCost > 0 ? ["gold"] : [],
    ({ gold }) => Math.floor(gold ?? 0),
  );
  useListenToEntityProps(
    teamEntity,
    goldCost > 0 && teamGoldEnabled ? ["gold"] : [],
    ({ gold }) => Math.floor(gold ?? 0),
  );
  const hasGold = getEffectivePlayerGold(entity.owner) >= goldCost;

  // Check if action is disabled during construction
  const blockedByConstructing = useListenToEntityProps(
    entity,
    "canExecuteWhileConstructing" in action &&
      action.canExecuteWhileConstructing === true
      ? []
      : ["progress"],
    ({ progress }) => typeof progress === "number",
  );

  // Check if action is on cooldown (for auto actions with cooldowns)
  const orderId = "order" in action ? action.order : undefined;
  const actionCooldown = "cooldown" in action ? action.cooldown : undefined;
  const cooldownRemaining = useListenToEntityProps(
    entity,
    orderId && actionCooldown ? ["actionCooldowns"] : [],
    ({ actionCooldowns }) => actionCooldowns?.[orderId!] ?? 0,
  );
  const onCooldown = cooldownRemaining > 0;

  const isAutocastable = action.type === "auto" && !!action.autocast;
  const isAutocastEnabled = useListenToEntityProps(
    entity,
    isAutocastable && orderId ? ["autocast"] : [],
    ({ autocast }) => orderId ? autocast?.includes(orderId) ?? false : false,
  );

  // Handler for right-click to toggle autocast for all selected units with this action
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2 || !isAutocastable || !orderId) return;

    // Find all selected units that have this action
    const unitsWithAction = Array.from(selection)
      .filter((e) => findActionByOrder(e, orderId))
      .map((e) => e.id);

    if (unitsWithAction.length === 0) return;

    // Use primary unit's state to determine enable/disable for all
    const enabling = !isAutocastEnabled;
    send({
      type: "unitOrder",
      order: orderId,
      units: unitsWithAction,
      autocast: enabling,
    });

    playSound("ui", enabling ? "chimes1" : "click1", { volume: 0.3 });
  }, [isAutocastable, orderId, isAutocastEnabled]);

  const disabled = !hasMana || !hasGold || blockedByConstructing || onCooldown;

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
          cooldownRemaining={cooldownRemaining}
          cooldownTotal={actionCooldown}
          onClick={handleClick}
          autocast={isAutocastable
            ? isAutocastEnabled ? "enabled" : "disabled"
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
          iconProps={action.iconEffect
            ? iconEffects[action.iconEffect](owningPlayer?.id)
            : undefined}
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
});
