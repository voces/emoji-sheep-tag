import { useReactiveVar } from "@/hooks/useVar.tsx";
import { selectionVar } from "./ActionBar.tsx";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { Command } from "@/components/game/Command.tsx";
import { HorizontalBar } from "@/components/game/HorizontalBar.tsx";
import { styled, useTheme } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { useEntityIconProps } from "@/hooks/useEntityIconProps.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import {
  startFollowingEntity,
  stopFollowingEntity,
} from "../../../../api/camera.ts";
import { getActiveOrder } from "../../../../controls.ts";
import { mouse, MouseButtonEvent } from "../../../../mouse.ts";
import { handleTargetOrder } from "../../../../controls/orderHandlers.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useEffect } from "react";
import { playSound } from "../../../../api/sound.ts";
import { pick } from "../../../../util/pick.ts";

const PrimaryPortraitContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StyledCommand = styled(Command)`
  width: calc(64px * 2 + 4px);
  height: calc(64px * 2 + 4px);
`;

const Bars = () => {
  const theme = useTheme();
  const selection = useReactiveVar(selectionVar);
  useListenToEntityProps(selection, ["health", "mana", "buffs"]);
  const localPlayer = useLocalPlayer();

  if (!selection) return null;

  const showProgress = typeof selection.progress === "number" &&
    selection.progress !== 1;

  const expiringBuffs =
    selection.buffs?.filter((buff) =>
      localPlayer && isAlly(selection, localPlayer.id) && buff.expiration &&
      typeof buff.remainingDuration === "number"
    ) ?? [];

  const hasHealth = typeof selection.health === "number";
  const hasMana = typeof selection.mana === "number";

  // Build array of bars to render
  const bars = [];

  // Always add progress bar if active
  if (showProgress) {
    bars.push({
      key: "progress",
      value: (selection.progress ?? 1) * (selection.completionTime ?? 1),
      max: 1 * (selection.completionTime ?? 1),
      color: theme.colors.green,
      displayValues: true,
    });
  }

  // Always add buff bars
  expiringBuffs.forEach((buff, i) => {
    bars.push({
      key: `buff-${i}`,
      value: buff.remainingDuration!,
      max: buff.totalDuration ?? buff.remainingDuration!,
      color: theme.colors.gold,
      displayValues: true,
    });
  });

  // Add health bar if entity has health OR we'd only have ≤1 bar total (including potential mana bar)
  const showHealth = hasHealth || (bars.length + (hasMana ? 1 : 0) <= 1);
  if (showHealth) {
    bars.push({
      key: "health",
      value: selection.health ?? 1,
      max: selection.maxHealth ?? selection.health ?? 1,
      color: "#ff4444",
      displayValues: !!selection.maxHealth && !!selection.health,
    });
  }

  // Add mana bar if entity has mana OR we would only have 1 bar otherwise
  const showMana = hasMana || bars.length <= 1;
  if (showMana) {
    bars.push({
      key: "mana",
      value: selection.mana ?? 0,
      max: selection.maxMana ?? selection.mana ?? 0,
      color: theme.colors.mana,
      displayValues: !!selection.maxMana && !!selection.mana,
    });
  }

  const height = (64 - (bars.length - 1) * 4) / bars.length;

  return (
    <VStack $gap="sm" key={selection.id}>
      {bars.map((bar) => (
        <HorizontalBar
          key={bar.key}
          value={bar.value}
          max={bar.max}
          color={bar.color}
          height={height}
          displayValues={bar.displayValues}
        />
      ))}
    </VStack>
  );
};

export const PrimaryPortrait = () => {
  const selection = useReactiveVar(selectionVar);
  const iconProps = useEntityIconProps(selection);
  useListenToEntityProps(selection, ["icon", "model", "prefab"]);

  // Handle mouse up on global mouse - stop following
  useEffect(() => {
    const handleMouseUp = () => stopFollowingEntity();

    mouse.addEventListener("mouseButtonUp", handleMouseUp);
    return () => mouse.removeEventListener("mouseButtonUp", handleMouseUp);
  }, []);

  if (!selection) return null;

  const icon = selection.icon || selection.model || selection.prefab;

  if (!icon) return null;

  const handleClick = () => {
    const activeOrder = getActiveOrder();
    if (activeOrder) {
      // If there's an active order, create a synthetic mouse event to execute it on this entity
      const syntheticEvent = Object.assign(
        new MouseButtonEvent("down", "left"),
        {
          intersects: new ExtendedSet([selection]),
          world: {
            x: selection.position?.x ?? 0,
            y: selection.position?.y ?? 0,
          },
        },
      );
      const success = handleTargetOrder(syntheticEvent);
      if (!success) {
        playSound("ui", pick("error1"), { volume: 0.3 });
      }
    } else {
      // Otherwise, start following the entity
      startFollowingEntity(selection);
    }
  };

  return (
    <PrimaryPortraitContainer>
      <StyledCommand
        icon={icon}
        iconProps={iconProps}
        name={selection.name ?? selection.id}
        hideTooltip
        onClick={handleClick}
      />
      <Bars />
    </PrimaryPortraitContainer>
  );
};
