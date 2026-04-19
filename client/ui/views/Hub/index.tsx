import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { ChevronLeft, Globe, Users } from "lucide-react";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { lobbiesVar } from "@/vars/lobbies.ts";
import { playerNameVar } from "@/vars/playerName.ts";
import { stateVar } from "@/vars/state.ts";
import {
  ActionButton,
  PrimaryButton,
  SmallGhostButton,
} from "@/components/forms/ActionButton.tsx";
import { Tag } from "@/components/Tag.tsx";
import { send } from "../../../messaging.ts";
import { setStoredPlayerName } from "../../../util/playerPrefs.ts";
import { colors } from "@/shared/data.ts";
import { disconnect } from "../../../connection.ts";

const HubCard = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 460px;
  max-width: calc(100% - 32px);
  max-height: calc(100vh - 80px);
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.lg}, ${({ theme }) =>
    theme.shadow.inset};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(12px);
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 10px ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.surface[0]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
  flex: 1;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => theme.space[5]};
  overflow-y: auto;
  min-height: 0;
`;

const NameRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  cursor: text;
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.DEFAULT};
  }

  &:focus-within {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
  }
`;

const NameLabel = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.lo};
  white-space: nowrap;
`;

const NameField = styled.input`
  flex: 1;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.ink.hi};
  font: inherit;
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  padding: 0;
  outline: none;
  min-width: 0;

  &&:focus {
    background: transparent;
    box-shadow: none;
  }
`;

const LobbyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const LobbyRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 10px ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.surface[0]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  transition: border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.DEFAULT};
  }
`;

const LobbyIcon = styled.span`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.ink.mid};
  flex-shrink: 0;
`;

const LobbyInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const LobbyName = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  color: ${({ theme }) => theme.ink.hi};
`;

const LobbyMeta = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

const StatusDot = styled.span<{ $open: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $open, theme }) =>
    $open ? theme.success.DEFAULT : theme.game.orange};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[8]} ${({ theme }) => theme.space[4]};
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.ink.lo};
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.text.md};
  color: ${({ theme }) => theme.ink.lo};
  max-width: 260px;
`;

export const Hub = () => {
  const { t } = useTranslation();
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

  const handleBack = () => {
    disconnect();
    stateVar("menu");
  };

  return (
    <HubCard>
      <Header>
        <SmallGhostButton
          type="button"
          onClick={handleBack}
          title={t("hub.back")}
        >
          <ChevronLeft size={16} />
        </SmallGhostButton>
        <HeaderTitle>{t("hub.title")}</HeaderTitle>
        <Tag>
          <Users size={12} />{" "}
          {lobbies.reduce((sum, l) => sum + l.playerCount, 0)}
        </Tag>
      </Header>
      <Body>
        <NameRow>
          <NameLabel>{t("hub.displayName")}</NameLabel>
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
            spellCheck={false}
          />
        </NameRow>

        <PrimaryButton
          type="button"
          onClick={() => send({ type: "createLobby" })}
        >
          {t("hub.createLobby")}
        </PrimaryButton>

        {lobbies.length > 0
          ? (
            <LobbyList>
              {lobbies.map((l) => (
                <LobbyRow key={l.name}>
                  <LobbyIcon>
                    <Globe size={16} />
                  </LobbyIcon>
                  <LobbyInfo>
                    <LobbyName>{l.name}</LobbyName>
                    <LobbyMeta>
                      <StatusDot $open={l.isOpen} />
                      {l.isOpen
                        ? t("hub.open")
                        : l.status === "playing"
                        ? t("hub.playing")
                        : t("hub.full")}
                      <span>
                        {t("hub.playerCount", {
                          current: l.playerCount,
                          max: colors.length,
                        })}
                      </span>
                      {l.shard && <span>{l.shard}</span>}
                      {l.host && (
                        <span>
                          {t("hub.hostedBy", { name: l.host })}
                        </span>
                      )}
                    </LobbyMeta>
                  </LobbyInfo>
                  <ActionButton
                    type="button"
                    onClick={() =>
                      send({ type: "joinLobby", lobbyName: l.name })}
                    disabled={!l.isOpen}
                  >
                    {t("hub.join")}
                  </ActionButton>
                </LobbyRow>
              ))}
            </LobbyList>
          )
          : (
            <EmptyState>
              <EmptyIcon>
                <Globe size={22} />
              </EmptyIcon>
              <EmptyText>{t("hub.noLobbies")}</EmptyText>
            </EmptyState>
          )}
      </Body>
    </HubCard>
  );
};
