import { styled } from "styled-components";
import { useRef, useState } from "react";
import { HStack, Positional } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { lobbiesVar } from "@/vars/lobbies.ts";
import { playerNameVar } from "@/vars/playerName.ts";
import { Button } from "@/components/forms/Button.tsx";
import { send } from "../../../messaging.ts";
import { setStoredPlayerName } from "../../../util/playerPrefs.ts";
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

const NameBox = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  cursor: text;

  &.hover {
    border-color: rgba(255, 255, 255, 0.25);
  }

  &:focus-within {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.12);
  }
`;

const NameLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  opacity: 0.5;
  white-space: nowrap;
`;

const NameField = styled.input`
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  outline: none;
  min-width: 0;

  &&:focus {
    background: transparent;
    box-shadow: none;
  }
`;

export const Hub = () => {
  const lobbies = useReactiveVar(lobbiesVar);
  const playerName = useReactiveVar(playerNameVar);
  const [draft, setDraft] = useState(playerName);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== playerName) {
      send({ type: "changeName", name: trimmed });
      setStoredPlayerName(trimmed);
    } else {
      setDraft(playerName);
    }
    inputRef.current?.blur();
  };

  return (
    <HubMain>
      <NameBox>
        <NameLabel>Display name:</NameLabel>
        <NameField
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setDraft(playerName);
              inputRef.current?.blur();
            }
          }}
          maxLength={16}
        />
      </NameBox>
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
