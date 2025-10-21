import { selection } from "../../../systems/autoSelect.ts";
import { styled } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { Avatar } from "@/components/game/Avatar.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { useMemo } from "react";
import { Entity } from "../../../ecs.ts";

const AvatarContainer = styled(VStack)`
  pointer-events: none;
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  left: ${({ theme }) => theme.spacing.md};
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
  }, [selection.size]);

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

// prefab
