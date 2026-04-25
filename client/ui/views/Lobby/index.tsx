import { useEffect, useState } from "react";
import { styled } from "styled-components";
import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { AccentTag, Tag } from "@/components/Tag.tsx";
import { SmallGhostButton } from "@/components/forms/ActionButton.tsx";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { send } from "../../../messaging.ts";
import { ChevronLeft, Settings } from "lucide-react";
import { Players } from "./Players.tsx";
import { LobbySettings } from "./LobbySettings.tsx";
import { CaptainsDraft } from "./CaptainsDraft/index.tsx";
import { LobbyFooter } from "./LobbyFooter.tsx";
import { MAPS } from "@/shared/maps/manifest.ts";
import { isMultiplayer } from "../../../connection.ts";
import { stats } from "../../../util/Stats.ts";

const LobbyShell = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(1280px, calc(100vw - 80px));
  height: min(820px, calc(100vh - 120px));
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.lg}, ${({ theme }) =>
    theme.shadow.inset};
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.surface[0]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

const TopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const TopRight = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
`;

const CrumbSep = styled.span`
  color: ${({ theme }) => theme.ink.mute};
  font-size: ${({ theme }) => theme.text.sm};
`;

const Crumb = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.lo};
`;

const CrumbCurrent = styled(Crumb)`
  color: ${({ theme }) => theme.ink.hi};
  font-weight: 500;
`;

const PingDot = styled.span<{ $ping: number }>`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $ping, theme }) =>
    $ping < 50
      ? theme.success.DEFAULT
      : $ping < 100
      ? theme.game.orange
      : theme.danger.DEFAULT};
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => theme.space[4]};
  overflow: hidden;
  min-height: 0;
`;

const PingTag = ({ shardLabel }: { shardLabel: string | undefined }) => {
  const [ping, setPing] = useState(NaN);
  useEffect(() => {
    if (!isMultiplayer()) return;
    const id = setInterval(() => setPing(stats.msPanel.value), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Tag>
      {!isNaN(ping) && <PingDot $ping={ping} />}
      {shardLabel}
      {!isNaN(ping) && ` ${Math.round(ping)}ms`}
    </Tag>
  );
};

export const Lobby = () => {
  const { t } = useTranslation();
  const captainsDraft = useReactiveVar(captainsDraftVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const players = usePlayers();
  useListenToEntities(players, ["team"]);

  const inCaptainsMode = !!captainsDraft &&
    captainsDraft.phase !== "drafted" &&
    captainsDraft.phase !== "reversed";

  const selectedMap = MAPS.find((m) => m.id === lobbySettings.map);
  const sheepCount = players.filter((p) => p.team === "sheep").length;
  const wolfCount = players.filter((p) => p.team === "wolf").length;

  const currentShard = lobbySettings.shard
    ? lobbySettings.shards.find((s) => s.id === lobbySettings.shard)
    : lobbySettings.shards[0];
  const shardLabel = currentShard?.region ?? currentShard?.name;

  return (
    <LobbyShell>
      <TopBar>
        <TopLeft>
          <SmallGhostButton onClick={() => send({ type: "leaveLobby" })}>
            <ChevronLeft size={14} /> {t("lobby.leave")}
          </SmallGhostButton>
          <CrumbSep>/</CrumbSep>
          <Crumb>
            {t(isMultiplayer() ? "lobby.multiplayer" : "lobby.offline")}
          </Crumb>
          <CrumbSep>/</CrumbSep>
          <CrumbCurrent>
            {lobbySettings.name ?? selectedMap?.name ?? lobbySettings.map}
          </CrumbCurrent>
          <AccentTag>
            {sheepCount}v{wolfCount}
          </AccentTag>
          {isMultiplayer() && <PingTag shardLabel={shardLabel} />}
        </TopLeft>
        <TopRight>
          <SmallGhostButton onClick={() => showSettingsVar(true)}>
            <Settings size={13} /> {t("lobby.settings")}
          </SmallGhostButton>
        </TopRight>
      </TopBar>

      <MainGrid>
        {inCaptainsMode ? <CaptainsDraft /> : <Players />}
        <LobbySettings />
      </MainGrid>

      <LobbyFooter />
    </LobbyShell>
  );
};
