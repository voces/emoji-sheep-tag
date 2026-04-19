import { selection } from "../../../../systems/selection.ts";
import { styled } from "styled-components";
import { Avatar } from "@/components/game/Avatar.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { useMemo } from "react";
import { Entity } from "../../../../ecs.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { selectionFocusVar } from "@/vars/selectionFocus.ts";

const AvatarContainer = styled.div<{ $rows: number; $cellSize: number }>`
  display: grid;
  gap: ${({ theme }) => theme.space[1]};
  grid-template-rows: repeat(${({ $rows }) => $rows}, auto);
  grid-auto-flow: column;

  & > div > div:first-child {
    width: ${({ $cellSize }) => $cellSize}px;
    height: ${({ $cellSize }) => $cellSize}px;
  }
`;

const getGroupKey = (entity: Entity): string =>
  entity.unique ? `unique:${entity.id}` : `prefab:${entity.prefab ?? "none"}`;

export const Avatars = (
  props: Omit<
    React.ComponentProps<typeof AvatarContainer>,
    "$rows" | "$cellSize"
  >,
) => {
  useSet(selection);
  const focused = useReactiveVar(selectionFocusVar);
  const focusedGroupKey = focused ? getGroupKey(focused) : undefined;

  const groups = useMemo(() => {
    const grouped = new Map<string, Entity[]>();

    for (const entity of selection) {
      const key = getGroupKey(entity);
      const group = grouped.get(key) ?? [];
      group.push(entity);
      grouped.set(key, group);
    }

    return grouped;
  }, [Array.from(selection).map((e) => e.id).join("|")]);

  if (!selection.size) return null;

  const rows = groups.size <= 4 ? 2 : 3;

  return (
    <AvatarContainer $rows={rows} $cellSize={rows <= 2 ? 54 : 44} {...props}>
      {Array.from(groups.entries(), ([groupKey, entities]) => (
        <Avatar
          key={groupKey ?? "none"}
          entity={entities[0]}
          count={entities.length > 1 ? entities.length : undefined}
          focused={groupKey === focusedGroupKey}
        />
      ))}
    </AvatarContainer>
  );
};
