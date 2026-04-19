import { styled } from "styled-components";
import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { draftModeVar } from "@/vars/draftMode.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import {
  ActionButton,
  LargePrimaryButton,
} from "@/components/forms/ActionButton.tsx";
import { useShakeError } from "@/components/ShakeError.tsx";
import { send } from "../../../messaging.ts";

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.surface[0]};
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  gap: ${({ theme }) => theme.space[3]};
`;

const FooterInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
`;

const FooterActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
`;

export const LobbyFooter = () => {
  const { t } = useTranslation();
  const localPlayer = useLocalPlayer();
  const players = usePlayers();
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const draftMode = useReactiveVar(draftModeVar);
  const captainsDraft = useReactiveVar(captainsDraftVar);
  useListenToEntities(players, ["team"]);

  const isHost = localPlayer?.id === lobbySettings.host;
  const nonObserversCount = players.filter((p) => p.team !== "observer").length;

  const {
    ref: startRef,
    showError,
    errorBubble,
    Wrapper: ShakeWrapper,
  } = useShakeError();

  const isCaptainsPhase = captainsDraft?.phase === "drafted" ||
    captainsDraft?.phase === "reversed";

  const handleStart = () => {
    if (nonObserversCount < 2) {
      showError(t("lobby.needMorePlayers"));
      return;
    }
    send({
      type: "start",
      fixedTeams: isCaptainsPhase || draftMode === "manual",
    });
  };

  const handlePractice = () => {
    if (nonObserversCount < 1) {
      showError(t("lobby.needMorePlayers"));
      return;
    }
    send({ type: "start", practice: true });
  };

  const startLabel = isCaptainsPhase
    ? captainsDraft?.phase === "drafted"
      ? t("lobby.startRound1")
      : t("lobby.startRound2")
    : draftMode === "smart"
    ? t("lobby.startGameSmart")
    : t("lobby.startGameManual");

  const startTooltip = isCaptainsPhase
    ? undefined
    : draftMode === "smart"
    ? t("lobby.smartDraftTooltip")
    : t("lobby.manualTooltip");

  return (
    <Footer>
      <FooterInfo />
      <FooterActions>
        {isHost && (
          <>
            {isCaptainsPhase && captainsDraft?.phase === "drafted" && (
              <ActionButton
                type="button"
                onClick={() => send({ type: "reverseTeams" })}
                title={t("lobby.reverseTooltip")}
              >
                {t("lobby.reverseTeams")}
              </ActionButton>
            )}
            <ActionButton type="button" onClick={handlePractice}>
              {t("lobby.practice")}
            </ActionButton>
            <ShakeWrapper ref={startRef}>
              <LargePrimaryButton
                type="button"
                onClick={handleStart}
                title={startTooltip}
              >
                {startLabel}
              </LargePrimaryButton>
            </ShakeWrapper>
            {errorBubble}
          </>
        )}
      </FooterActions>
    </Footer>
  );
};
