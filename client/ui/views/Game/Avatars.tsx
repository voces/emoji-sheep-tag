import { useEffect, useState } from "react";
import { selection } from "../../../systems/autoSelect.ts";
import { styled } from "npm:styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { Avatar } from "@/components/game/Avatar.tsx";

const AvatarContainer = styled(VStack)`
  pointer-events: none;
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  left: ${({ theme }) => theme.spacing.md};
`;

export const Avatars = () => {
  const [, next] = useState(0);

  useEffect(() => {
    const clearAdd = selection.addEventListener(
      "add",
      () => next((p) => p + 1),
    );

    const clearDelete = selection.addEventListener(
      "delete",
      () => next((p) => p + 1),
    );

    return () => {
      clearAdd();
      clearDelete();
    };
  }, []);

  if (!selection.size) return null;

  return (
    <AvatarContainer>
      {/* TODO: Group by? */}
      {Array.from(selection, (e) => <Avatar key={e.id} entity={e} />)}
    </AvatarContainer>
  );
};
