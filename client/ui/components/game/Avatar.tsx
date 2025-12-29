import { HStack } from "@/components/layout/Layout.tsx";
import { Command } from "@/components/game/Command.tsx";
import { VerticalBar } from "@/components/game/VerticalBar.tsx";
import type { Item } from "@/shared/types.ts";
import { useTheme } from "styled-components";
import {
  useListenToEntityProp,
  useListenToEntityProps,
} from "@/hooks/useListenToEntityProp.ts";
import { styled } from "styled-components";
import { Entity } from "../../../ecs.ts";
import { svgs } from "../../../systems/three.ts";
import { useEntityIconProps } from "@/hooks/useEntityIconProps.ts";
import {
  startFollowingEntity,
  stopFollowingEntity,
} from "../../../api/camera.ts";
import { getActiveOrder } from "../../../controls.ts";
import { mouse, MouseButtonEvent } from "../../../mouse.ts";
import { handleTargetOrder } from "../../../controls/orderHandlers.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useEffect, useMemo, useRef } from "react";
import { playSound } from "../../../api/sound.ts";
import { pick } from "../../../util/pick.ts";
import { getPlayer } from "@/shared/api/player.ts";

const MiniIconWrapper = styled.div<{ $rows: number }>`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(${({ $rows }) => $rows}, 1fr);
  justify-content: start;
  height: ${({ $rows }) => `${$rows * 32}px`};
  gap: 2px;
  & > div {
    width: 32px;
    height: 32px;
    border-width: 2px;
  }
  &:empty {
    display: none;
  }
`;

export const Inventory = (
  { entity, rows = 1 }: { entity: Entity; rows?: number },
) => {
  const items = useListenToEntityProp(entity, "inventory");
  const ownerColor = getPlayer(entity.owner)?.playerColor ?? undefined;
  const grouped = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    for (const item of items ?? []) {
      if (grouped[item.id]) grouped[item.id].push(item);
      else grouped[item.id] = [item];
    }
    return Object.values(grouped);
  }, [items]);
  if (!grouped.length) return null;

  return (
    <MiniIconWrapper $rows={rows}>
      {grouped.map((g, i) => (
        <Command
          key={i}
          name={g[0].name}
          description={g[0].description}
          icon={g[0].icon ?? g[0].id}
          count={g[0].charges ?? (g.length > 1 ? g.length : undefined)}
          accentColor={ownerColor}
        />
      ))}
    </MiniIconWrapper>
  );
};

const getFlashDuration = (remainingDuration?: number): number => {
  if (remainingDuration === undefined || remainingDuration >= 10) return 0;
  return 0.75 + remainingDuration / 8;
};

export const Buffs = (
  { entity, rows = 1 }: {
    entity: Entity;
    rows?: number;
  },
) => {
  const buffs = useListenToEntityProp(entity, "buffs");
  const ownerColor = getPlayer(entity.owner)?.playerColor ?? undefined;
  if (!buffs?.length) return null;

  return (
    <MiniIconWrapper $rows={rows}>
      {buffs.filter((b) => !b.expiration && (b.icon ?? b.model ?? "") in svgs)
        .map(
          (buff, i) => (
            <Command
              key={i}
              name={buff.name ?? ""}
              description={buff.description}
              icon={buff.icon ?? buff.model ?? ""}
              flashDuration={getFlashDuration(buff.remainingDuration)}
              accentColor={ownerColor}
            />
          ),
        )}
    </MiniIconWrapper>
  );
};

export const Avatar = (
  { entity, count }: { entity: Entity; count?: number },
) => {
  const theme = useTheme();
  useListenToEntityProps(entity, [
    "health",
    "maxHealth",
    "mana",
    "maxMana",
    "inventory",
    "progress",
    "buffs",
  ]);

  const hasHealth = typeof entity.health === "number" &&
    typeof entity.maxHealth === "number";
  const hasMana = typeof entity.mana === "number" &&
    typeof entity.maxMana === "number";
  const hasProgress = typeof entity.progress === "number";

  const iconProps = useEntityIconProps(entity);
  const ownerColor = getPlayer(entity.owner)?.playerColor ?? undefined;
  const startedFollowingRef = useRef(false);

  // Get expiring buffs for timers
  const expiringBuffs =
    entity.buffs?.filter((buff) =>
      buff.expiration && typeof buff.remainingDuration === "number"
    ) ?? [];

  const handleClick = () => {
    const activeOrder = getActiveOrder();
    if (activeOrder) {
      // If there's an active order, create a synthetic mouse event to execute it on this entity
      const syntheticEvent = Object.assign(
        new MouseButtonEvent("down", "left"),
        {
          intersects: new ExtendedSet([entity]),
          world: { x: entity.position?.x ?? 0, y: entity.position?.y ?? 0 },
        },
      );
      const result = handleTargetOrder(syntheticEvent);
      if (!result.success) playSound("ui", pick("error1"), { volume: 0.3 });
    } else {
      // Otherwise, start following the entity
      startFollowingEntity(entity);
      startedFollowingRef.current = true;
    }
  };

  // Handle mouse up on global mouse - stop following only if we started it
  useEffect(() => {
    const handleMouseUp = () => {
      if (startedFollowingRef.current) {
        stopFollowingEntity();
        startedFollowingRef.current = false;
      }
    };

    mouse.addEventListener("mouseButtonUp", handleMouseUp);
    return () => mouse.removeEventListener("mouseButtonUp", handleMouseUp);
  }, []);

  return (
    <HStack $gap="sm">
      <Command
        role="button"
        name={entity.name ?? entity.id}
        icon={entity.icon ?? entity.model ?? entity.prefab}
        iconProps={iconProps}
        hideTooltip
        count={count}
        onClick={handleClick}
        accentColor={ownerColor}
      />
      <HStack $gap="xs">
        {expiringBuffs.map((buff, i) => (
          <VerticalBar
            key={i}
            value={buff.remainingDuration!}
            max={buff.totalDuration ?? buff.remainingDuration!}
            color={theme.colors.gold}
          />
        ))}
        {hasProgress && (
          <VerticalBar
            value={entity.progress!}
            max={1}
            color={theme.colors.green}
          />
        )}
        {hasHealth && (
          <VerticalBar
            value={entity.health!}
            max={entity.maxHealth!}
            color="#ff4444"
          />
        )}
        {hasMana && (
          <VerticalBar
            value={entity.mana!}
            max={entity.maxMana!}
            color={theme.colors.mana}
          />
        )}
      </HStack>
      <Inventory key="inventory" entity={entity} />
      <Buffs key="buffs" entity={entity} />
    </HStack>
  );
};
