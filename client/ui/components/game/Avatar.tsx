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
import { svgs } from "../../../systems/models.ts";
import { useEntityIconProps } from "@/hooks/useEntityIconProps.ts";
import {
  startFollowingEntity,
  stopFollowingEntity,
} from "../../../api/camera.ts";
import { selectionFocusVar as selectionVar } from "@/vars/selectionFocus.ts";
import { mouse, MouseButtonEvent } from "../../../mouse.ts";
import {
  getActiveOrder,
  handleTargetOrder,
} from "../../../controls/orderHandlers.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useEffect, useMemo, useRef } from "react";
import { playSound } from "../../../api/sound.ts";
import { pick } from "../../../util/pick.ts";
import { getPlayer } from "@/shared/api/player.ts";

const MiniIconWrapper = styled.div<{ $rows: number; $size: number }>`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(${({ $rows }) => $rows}, 1fr);
  justify-content: start;
  height: ${({ $rows, $size }) => `${$rows * $size + ($rows - 1) * 2}px`};
  gap: 2px;
  & > div {
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    border-width: 1px;
  }
  & span[class] {
    font-size: ${({ $size }) => Math.max(7, $size * 0.4)}px;
    line-height: ${({ $size }) => Math.max(10, $size * 0.55)}px;
    height: ${({ $size }) => Math.max(10, $size * 0.55)}px;
    padding: 0 2px;
    bottom: 1px;
    left: 1px;
    right: auto;
  }
  &:empty {
    display: none;
  }
`;

export const Inventory = (
  { entity, rows = 1, size = 28 }: {
    entity: Entity;
    rows?: number;
    size?: number;
  },
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
    <MiniIconWrapper $rows={rows} $size={size}>
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
  { entity, rows = 1, size = 28 }: {
    entity: Entity;
    rows?: number;
    size?: number;
  },
) => {
  const buffs = useListenToEntityProp(entity, "buffs");
  const ownerColor = getPlayer(entity.owner)?.playerColor ?? undefined;

  const grouped = useMemo(() => {
    const filtered = buffs?.filter((b) =>
      !b.expiration && (b.icon ?? b.model ?? "") in svgs
    ) ?? [];
    const grouped: Record<string, typeof filtered> = {};
    for (const buff of filtered) {
      const key = buff.name ?? buff.icon ?? buff.model ?? "";
      if (grouped[key]) {
        grouped[key].push(buff);
      } else grouped[key] = [buff];
    }
    return Object.values(grouped);
  }, [buffs]);

  if (!grouped.length) return null;

  return (
    <MiniIconWrapper $rows={rows} $size={size}>
      {grouped.map((g, i) => (
        <Command
          key={i}
          name={g[0].name ?? ""}
          description={g[0].description}
          icon={g[0].icon ?? g[0].model ?? ""}
          flashDuration={getFlashDuration(
            Math.min(...g.map((b) => b.remainingDuration ?? Infinity)),
          )}
          accentColor={ownerColor}
          count={g.length > 1 ? g.length : undefined}
        />
      ))}
    </MiniIconWrapper>
  );
};

export const Avatar = (
  { entity, count, focused }: {
    entity: Entity;
    count?: number;
    focused?: boolean;
  },
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
  const expiringBuffs = useMemo(
    () =>
      entity.buffs?.filter((buff) =>
        buff.expiration && typeof buff.remainingDuration === "number"
      ) ?? [],
    [entity.buffs],
  );

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
      selectionVar(entity);
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
    <HStack $gap={1}>
      <Command
        role="button"
        name={entity.name ?? entity.id}
        icon={entity.icon ?? entity.model ?? entity.prefab}
        iconProps={iconProps}
        hideTooltip
        count={count}
        pressed={focused}
        onMouseDown={handleClick}
        accentColor={ownerColor}
      />
      <HStack $gap={1}>
        {expiringBuffs.map((buff, i) => (
          <VerticalBar
            key={i}
            value={buff.remainingDuration!}
            max={buff.totalDuration ?? buff.remainingDuration!}
            color={theme.game.gold}
          />
        ))}
        {hasProgress && (
          <VerticalBar
            value={entity.progress!}
            max={1}
            color={theme.game.green}
          />
        )}
        {hasHealth && (
          <VerticalBar
            value={entity.health!}
            max={entity.maxHealth!}
            color={theme.danger.DEFAULT}
          />
        )}
        {hasMana && (
          <VerticalBar
            value={entity.mana!}
            max={entity.maxMana!}
            color={theme.game.mana}
          />
        )}
      </HStack>
      <Inventory key="inventory" entity={entity} rows={2} size={20} />
      <Buffs key="buffs" entity={entity} rows={2} size={20} />
    </HStack>
  );
};
