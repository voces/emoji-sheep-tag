import { HStack } from "@/components/layout/Layout.tsx";
import { Command } from "@/components/game/Command.tsx";
import { VerticalBar } from "@/components/game/VerticalBar.tsx";
import type { Buff, Item } from "@/shared/types.ts";
import { useTheme } from "styled-components";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
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
import { useEffect, useMemo } from "react";
import { playSound } from "../../../api/sound.ts";
import { pick } from "../../../util/pick.ts";

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
  { items, rows = 1 }: { items: ReadonlyArray<Item>; rows?: number },
) => {
  const grouped = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    for (const item of items) {
      if (grouped[item.id]) grouped[item.id].push(item);
      else grouped[item.id] = [item];
    }
    return Object.values(grouped);
  }, [items]);

  return (
    <MiniIconWrapper $rows={rows}>
      {grouped.map((g, i) => (
        <Command
          key={i}
          name={g[0].name}
          description={g[0].description}
          icon={g[0].icon ?? g[0].id}
          count={g[0].charges ?? (g.length > 1 ? g.length : undefined)}
        />
      ))}
    </MiniIconWrapper>
  );
};

export const Buffs = (
  { entityBuffs, rows = 1 }: {
    entityBuffs: ReadonlyArray<Buff>;
    rows?: number;
  },
) => (
  <MiniIconWrapper $rows={rows}>
    {entityBuffs.filter((b) =>
      !b.expiration && (b.icon ?? b.model ?? "") in svgs
    )
      .map(
        (buff, i) => (
          <Command
            key={i}
            name=""
            icon={buff.icon ?? buff.model ?? ""}
            hideTooltip
          />
        ),
      )}
  </MiniIconWrapper>
);

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
      const success = handleTargetOrder(syntheticEvent);
      if (!success) {
        playSound("ui", pick("error1"), { volume: 0.3 });
      }
    } else {
      // Otherwise, start following the entity
      startFollowingEntity(entity);
    }
  };

  // Handle mouse up on global mouse - stop following
  useEffect(() => {
    const handleMouseUp = () => stopFollowingEntity();

    mouse.addEventListener("mouseButtonUp", handleMouseUp);
    return () => mouse.removeEventListener("mouseButtonUp", handleMouseUp);
  }, []);

  return (
    <HStack $gap="sm">
      <Command
        name={entity.name ?? entity.id}
        icon={entity.icon ?? entity.model ?? entity.prefab}
        iconProps={iconProps}
        hideTooltip
        count={count}
        onClick={handleClick}
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
      {entity.inventory?.length
        ? <Inventory key="inventory" items={entity.inventory} />
        : null}
      {entity.buffs?.length
        ? <Buffs key="buffs" entityBuffs={entity.buffs} />
        : null}
    </HStack>
  );
};
