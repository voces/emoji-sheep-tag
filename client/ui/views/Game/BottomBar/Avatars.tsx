import { selection } from "../../../../systems/selection.ts";
import { styled } from "styled-components";
import { Avatar } from "@/components/game/Avatar.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { useMemo } from "react";
import { Entity } from "../../../../ecs.ts";

const AvatarContainer = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  grid-template-rows: repeat(3, 1fr);
  grid-auto-flow: column;
`;

const getGroupKey = (entity: Entity): string =>
  entity.unique ? `unique:${entity.id}` : `prefab:${entity.prefab ?? "none"}`;

export const Avatars = () => {
  useSet(selection);

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

  return (
    <AvatarContainer>
      {Array.from(groups.entries(), ([groupKey, entities]) => (
        <Avatar
          key={groupKey ?? "none"}
          entity={entities[0]}
          count={entities.length > 1 ? entities.length : undefined}
        />
      ))}
    </AvatarContainer>
  );
};
