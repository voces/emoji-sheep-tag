import { selection } from "../../../systems/autoSelect.ts";
import { styled } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { Avatar } from "@/components/game/Avatar.tsx";
import { useSet } from "@/hooks/useSet.ts";

const AvatarContainer = styled(VStack)`
  pointer-events: none;
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  left: ${({ theme }) => theme.spacing.md};
`;

export const Avatars = () => {
  useSet(selection);

  if (!selection.size) return null;

  return (
    <AvatarContainer>
      {/* TODO: Group by? */}
      {Array.from(selection, (e) => <Avatar key={e.id} entity={e} />)}
    </AvatarContainer>
  );
};
