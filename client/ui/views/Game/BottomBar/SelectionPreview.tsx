import { useReactiveVar } from "@/hooks/useVar.tsx";
import { selectionVar } from "./ActionBar.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { selection } from "../../../../systems/selection.ts";
import { Avatars } from "./Avatars.tsx";
import { useListenToEntityProps } from "@/hooks/useListenToEntityProp.ts";
import {
  computeUnitAttackSpeed,
  computeUnitDamage,
  computeUnitMovementSpeed,
} from "@/shared/api/unit.ts";
import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { Buffs, Inventory } from "@/components/game/Avatar.tsx";

const StatsContainer = styled(VStack)`
  min-width: 134px;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const UnitStats = () => {
  const selection = useReactiveVar(selectionVar);

  const attackDamage = useListenToEntityProps(selection, [
    "attack",
    "buffs",
    "inventory",
  ], () => selection?.attack ? computeUnitDamage(selection) : undefined);

  const attackSpeed = useListenToEntityProps(
    selection,
    [
      "attack",
      "buffs",
      "inventory",
    ],
    () =>
      selection?.attack
        ? Math.round(
          selection.attack.cooldown / computeUnitAttackSpeed(selection) * 100,
        ) / 100
        : undefined,
  );

  const movementSpeed = useListenToEntityProps(
    selection,
    ["movementSpeed", "buffs", "inventory"],
    () =>
      typeof selection?.movementSpeed === "number"
        ? Math.round(computeUnitMovementSpeed(selection) * 100)
        : undefined,
  );

  useListenToEntityProps(selection, ["inventory"]);

  if (!selection) return null;

  return (
    <StatsContainer>
      <div style={{ textAlign: "center" }}>
        {selection.name ?? selection.id}
      </div>

      {typeof attackDamage === "number" && (
        <HStack $align="center" $gap="sm">
          <span style={{ width: 29, height: 29 }}>
            <SvgIcon icon="sword" />
          </span>
          <span>{attackDamage}</span>
        </HStack>
      )}
      {typeof attackSpeed === "number" && (
        <HStack $align="center" $gap="sm">
          <span style={{ width: 29, height: 29 }}>
            <SvgIcon icon="claw" />
          </span>
          <span>{attackSpeed}</span>
        </HStack>
      )}
      {typeof movementSpeed === "number" && (
        <HStack $align="center" $gap="sm">
          <span style={{ width: 29, height: 29 }}>
            <SvgIcon icon="runningShoes" />
          </span>
          <span>{movementSpeed}</span>
        </HStack>
      )}

      {selection.inventory && (
        <Inventory
          items={selection.inventory}
          rows={1}
        />
      )}
      {selection.buffs && (
        <Buffs
          entityBuffs={selection.buffs}
          rows={1}
        />
      )}
    </StatsContainer>
  );
};

export const SelectionPreview = () => {
  const primary = useReactiveVar(selectionVar);
  useSet(selection);

  if (!primary) return null;

  if (selection.size === 1) return <UnitStats />;

  return <Avatars />;
};
