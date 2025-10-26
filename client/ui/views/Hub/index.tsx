import { styled } from "styled-components";
import { HStack, Positional } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { lobbiesVar } from "@/vars/lobbies.ts";
import { Button } from "@/components/forms/Button.tsx";
import { send } from "../../../messaging.ts";
import { colors } from "@/shared/data.ts";

const HubMain = styled(Positional)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  width: min(95%, 350px);
  height: min(95%, 800px);
  pointer-events: none;
  justify-content: center;
`;

const NewLobby = styled(Button)`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const Hint = styled.span`
  font-size: ${({ theme }) => theme.fontSize.md};
  color: #bbb;
`;

export const Hub = () => {
  const lobbies = useReactiveVar(lobbiesVar);

  return (
    <HubMain>
      <NewLobby onClick={() => send({ type: "createLobby" })}>
        New lobby
      </NewLobby>

      {lobbies.map((l) => (
        <Card key={l.name}>
          <HStack $justifyContent="space-between">
            <div>
              <span>{l.name}</span>{" "}
              <Hint>
                {!l.isOpen
                  ? `(${l.playerCount}/${colors.length} - Full)`
                  : `(${l.playerCount} player${l.playerCount > 1 ? "s" : ""})`}
              </Hint>
            </div>
            <Button
              onClick={() => send({ type: "joinLobby", lobbyName: l.name })}
              disabled={!l.isOpen}
            >
              Join
            </Button>
          </HStack>
        </Card>
      ))}
    </HubMain>
  );
};
