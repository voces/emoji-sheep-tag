import { useReactiveVar } from "@/hooks/useVar.tsx";
import { selectionFocusVar } from "@/vars/selectionFocus.ts";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { Command } from "@/components/game/Command.tsx";
import { HorizontalBar } from "@/components/game/HorizontalBar.tsx";
import { styled, useTheme } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { useEntityIconProps } from "@/hooks/useEntityIconProps.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { useMemo } from "react";
import { useTargetOrFollow } from "@/hooks/useTargetOrFollow.ts";
import { AnimatedInstancedMesh } from "../../../../graphics/AnimatedInstancedMesh.ts";
import { collections } from "../../../../systems/models.ts";
import { PortraitCanvas } from "@/components/game/PortraitCanvas.tsx";

const PrimaryPortraitContainer = styled(VStack)`
  gap: ${({ theme }) => theme.space[1]};
`;

const StyledCommand = styled(Command)`
  width: 92px;
  height: 92px;
`;

const Bars = () => {
  const theme = useTheme();
  const selection = useReactiveVar(selectionFocusVar);
  useListenToEntityProps(selection, ["health", "mana", "buffs", "progress"]);
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
      color: theme.game.green,
      displayValues: true,
    });
  }

  // Always add buff bars
  expiringBuffs.forEach((buff, i) => {
    bars.push({
      key: `buff-${i}`,
      value: buff.remainingDuration!,
      max: buff.totalDuration ?? buff.remainingDuration!,
      color: theme.game.gold,
      displayValues: true,
    });
  });

  if (hasHealth) {
    bars.push({
      key: "health",
      value: selection.health ?? 1,
      max: selection.maxHealth ?? selection.health ?? 1,
      color: theme.danger.DEFAULT,
      displayValues: !!selection.maxHealth && !!selection.health,
    });
  }

  if (hasMana) {
    bars.push({
      key: "mana",
      value: selection.mana ?? 0,
      max: selection.maxMana ?? selection.mana ?? 0,
      color: theme.game.mana,
      displayValues: !!selection.maxMana && !!selection.mana,
    });
  }

  if (bars.length === 0) return null;

  const height = Math.min(
    20,
    Math.floor((44 - (bars.length - 1) * 4) / bars.length),
  );

  return (
    <VStack $gap={1} key={selection.id}>
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
  const selection = useReactiveVar(selectionFocusVar);
  const iconProps = useEntityIconProps(selection);
  useListenToEntityProps(selection, ["icon", "model", "prefab"]);
  const handleClick = useTargetOrFollow(selection);

  const icon = selection?.icon || selection?.model || selection?.prefab;
  const modelName = selection?.model ?? selection?.prefab;
  const hasPortraitCamera = useMemo(() => {
    if (!modelName) return false;
    const col = collections[modelName];
    return col instanceof AnimatedInstancedMesh && col.cameras.length > 0;
  }, [modelName]);

  return (
    <PrimaryPortraitContainer>
      <StyledCommand
        role="button"
        icon={hasPortraitCamera ? undefined : icon}
        iconProps={iconProps}
        name={selection?.name ?? selection?.id ?? ""}
        hideTooltip
        onMouseDown={handleClick}
      >
        {hasPortraitCamera && selection
          ? <PortraitCanvas entity={selection} />
          : undefined}
      </StyledCommand>
      <Bars />
    </PrimaryPortraitContainer>
  );
};
