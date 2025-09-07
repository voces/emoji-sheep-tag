import { HStack } from "@/components/layout/Layout.tsx";
import { Command } from "@/components/game/Command.tsx";
import { VerticalBar } from "@/components/game/VerticalBar.tsx";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { isAlly } from "@/shared/api/unit.ts";
import { getPlayer, useLocalPlayer } from "@/vars/players.ts";
import type { Entity, Item } from "@/shared/types.ts";
import { useTheme } from "npm:styled-components";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import { styled } from "npm:styled-components";

const InventoryWrapper = styled.div`
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

const itemMap = new WeakMap<Item, string>();
const getItemKey = (item: Item) => {
  const existing = itemMap.get(item);
  if (existing) return existing;
  const key = crypto.randomUUID();
  itemMap.set(item, key);
  return key;
};

const Inventory = ({ items }: { items: ReadonlyArray<Item> }) => (
  <InventoryWrapper>
    {items.map((item) => (
      <Command
        key={getItemKey(item)}
        name={item.name}
        icon={item.icon ?? item.id}
        hideTooltip
        count={item.charges}
      />
    ))}
  </InventoryWrapper>
);

export const Avatar = ({ entity }: { entity: Entity }) => {
  const localPlayer = useLocalPlayer();
  const theme = useTheme();
  useListenToEntityProps(entity, [
    "health",
    "maxHealth",
    "mana",
    "maxMana",
    "inventory",
  ]);

  const hasHealth = typeof entity.health === "number" &&
    typeof entity.maxHealth === "number";
  const hasMana = typeof entity.mana === "number" &&
    typeof entity.maxMana === "number";

  const iconEffect = entity.iconEffect ??
    (entity.isMirror && localPlayer && isAlly(entity, localPlayer.id)
      ? "mirror"
      : undefined);

  const iconEffectProps = iconEffect
    ? iconEffects[iconEffect](entity.owner)
    : (entity.alpha ? { style: { opacity: entity.alpha } } : undefined);
  const color = entity.owner ? getPlayer(entity.owner)?.color : undefined;
  const iconProps = { ...iconEffectProps, color };

  return (
    <HStack $gap="sm">
      <Command
        name={entity.name ?? entity.id}
        icon={entity.icon ?? entity.model ?? entity.prefab}
        iconProps={iconProps}
        hideTooltip
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
      </HStack>
      {entity.inventory?.length
        ? <Inventory items={entity.inventory}></Inventory>
        : null}
    </HStack>
  );
};
