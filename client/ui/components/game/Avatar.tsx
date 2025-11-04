import { HStack } from "@/components/layout/Layout.tsx";
import { Command } from "@/components/game/Command.tsx";
import { VerticalBar } from "@/components/game/VerticalBar.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { isAlly } from "@/shared/api/unit.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import type { Buff, Item } from "@/shared/types.ts";
import { useTheme } from "styled-components";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { styled } from "styled-components";
import { Entity } from "../../../ecs.ts";

const MiniIconWrapper = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 1fr 1fr;
  height: 64px;
  gap: 2px;
  & > div {
    width: 31px;
    height: 31px;
    border-width: 2px;
  }
`;

const Inventory = ({ items }: { items: ReadonlyArray<Item> }) => (
  <MiniIconWrapper>
    {items.map((item, i) => (
      <Command
        key={i}
        name={item.name}
        icon={item.icon ?? item.id}
        hideTooltip
        count={item.charges}
      />
    ))}
  </MiniIconWrapper>
);

const Buffs = ({ entityBuffs }: { entityBuffs: ReadonlyArray<Buff> }) => (
  <MiniIconWrapper>
    {entityBuffs.filter((b) => !b.expiration && (b.icon || b.model)).map(
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
  const localPlayer = useLocalPlayer();
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

  const iconEffect = entity.iconEffect ??
    (entity.isMirror && localPlayer && isAlly(entity, localPlayer.id)
      ? "mirror"
      : undefined);

  const iconEffectProps = iconEffect
    ? iconEffects[iconEffect](entity.owner)
    : (entity.alpha ? { style: { opacity: entity.alpha } } : undefined);
  const color = entity.playerColor ?? getPlayer(entity.owner)?.playerColor ??
    undefined;
  const iconProps: React.ComponentProps<typeof Command>["iconProps"] = {
    ...iconEffectProps,
    color,
  };
  if (
    entity.vertexColor && iconProps && !iconProps.overlayStyle?.backgroundColor
  ) {
    iconProps.overlayStyle = {
      ...iconProps.overlayStyle,
      backgroundColor: `#${entity.vertexColor.toString(16).padStart(6, "0")}`,
    };
  }

  // Get expiring buffs for timers
  const expiringBuffs =
    entity.buffs?.filter((buff) =>
      buff.expiration && typeof buff.remainingDuration === "number"
    ) ?? [];

  return (
    <HStack $gap="sm">
      <Command
        name={entity.name ?? entity.id}
        icon={entity.icon ?? entity.model ?? entity.prefab}
        iconProps={iconProps}
        hideTooltip
        count={count}
      />
      <HStack $gap="xs">
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
        {hasProgress && (
          <VerticalBar
            value={entity.progress!}
            max={1}
            color={theme.colors.green}
          />
        )}
        {expiringBuffs.map((buff, i) => (
          <VerticalBar
            key={i}
            value={buff.remainingDuration!}
            max={buff.totalDuration ?? buff.remainingDuration!}
            color={theme.colors.gold}
          />
        ))}
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
