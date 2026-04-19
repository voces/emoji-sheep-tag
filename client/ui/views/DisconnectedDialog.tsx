import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { WifiOff } from "lucide-react";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "@/vars/state.ts";
import { ActionButton } from "@/components/forms/ActionButton.tsx";
import { Dialog } from "@/components/layout/Dialog.tsx";
import { stopReconnecting } from "../../connection.ts";
import { unloadEcs } from "../../ecs.ts";
import { generateDoodads } from "@/shared/map.ts";
import { confirmEditorExit } from "@/util/editorExitConfirmation.ts";

const StyledDialog = styled(Dialog)`
  width: min(360px, calc(100vw - 80px));
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  padding: ${({ theme }) => theme.space[6]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[4]};
  text-align: center;
`;

const IconCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ theme }) => theme.danger.bg};
  color: ${({ theme }) => theme.danger.DEFAULT};
  display: grid;
  place-items: center;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.text.md};
  color: ${({ theme }) => theme.ink.lo};
`;

const Ellipsis = styled.span`
  position: relative;

  &::before {
    content: "...";
    visibility: hidden;
  }

  &::after {
    content: "";
    position: absolute;
    left: 0;
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0% {
      content: "";
    }
    25% {
      content: ".";
    }
    50% {
      content: "..";
    }
    75% {
      content: "...";
    }
  }
`;

export const DisconnectedDialog = () => {
  const { t } = useTranslation();
  const connectionStatus = useReactiveVar(connectionStatusVar);
  if (connectionStatus !== "disconnected") return null;

  const handleGiveUp = () => {
    if (!confirmEditorExit()) return;

    stateVar("menu");
    unloadEcs();
    generateDoodads(["dynamic"]);
    stopReconnecting();
    connectionStatusVar("notConnected");
  };

  return (
    <StyledDialog>
      <IconCircle>
        <WifiOff size={22} />
      </IconCircle>
      <Title>{t("disconnected.title")}</Title>
      <Subtitle>
        {t("disconnected.reconnecting")}
        <Ellipsis />
      </Subtitle>
      <ActionButton type="button" onClick={handleGiveUp}>
        {t("disconnected.giveUp")}
      </ActionButton>
    </StyledDialog>
  );
};
