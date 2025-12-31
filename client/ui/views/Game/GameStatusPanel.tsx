import { useEffect } from "react";
import { styled } from "styled-components";
import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { practiceVar } from "@/vars/practice.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { vipVar } from "@/vars/vip.ts";
import { editorVar } from "@/vars/editor.ts";
import { Player } from "@/shared/api/player.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";

const timersVar = makeVar<Entity[]>([]);
const spiritsVar = makeVar<Entity[]>([]);
const structuresByOwner: Record<string, Set<Entity>> = {};
const structuresByOwnerVar = makeVar(structuresByOwner);
const scoreboardExpandedVar = makeVar<boolean>(true);

app.addSystem({
  props: ["isTimer", "buffs"],
  onAdd: (e) => timersVar([...timersVar(), e]),
  onChange: () => timersVar([...timersVar()]),
  onRemove: (e) => timersVar(timersVar().filter((t) => t !== e)),
});

app.addSystem({
  props: ["prefab", "owner"],
  onAdd: (e) => {
    if (e.prefab === "spirit") spiritsVar([...spiritsVar(), e]);
  },
  onRemove: (e) => {
    if (e.prefab === "spirit") spiritsVar(spiritsVar().filter((s) => s !== e));
  },
});

app.addSystem({
  props: ["owner", "tilemap"],
  onAdd: (e) => {
    if (!isStructure(e) || !e.owner) return;
    let set = structuresByOwner[e.owner];
    if (!set) {
      set = new Set();
      structuresByOwner[e.owner] = set;
    }
    set.add(e);
    structuresByOwnerVar({ ...structuresByOwner });
  },
  onRemove: (e) => {
    // Check all owners since entity may have lost properties
    for (const owner in structuresByOwner) {
      const set = structuresByOwner[owner];
      if (set.delete(e)) {
        if (set.size === 0) delete structuresByOwner[owner];
        structuresByOwnerVar({ ...structuresByOwner });
        break;
      }
    }
  },
});

const Container = styled(VStack)`
  &:empty {
    display: none;
  }
`;

const Header = styled(Card)<{ $clickable: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
  background-color: rgb(from ${({ theme }) =>
    theme.colors.background} r g b / 0.5);
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  justify-content: space-between;
  pointer-events: all;

  &.hover > span:nth-of-type(2) {
    opacity: 0.85;
  }
`;

const ExpandIndicator = styled.span<{ $expanded: boolean }>`
  opacity: 0.5;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  &::after {
    content: "${({ $expanded }) => ($expanded ? "▲" : "▼")}";
  }
`;

const Body = styled(Card)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
  background-color: rgb(from ${({ theme }) =>
    theme.colors.background} r g b / 0.5);
`;

const TeamSection = styled.div`
  &:not(:last-child) {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

const TeamHeader = styled.div`
  font-weight: bold;
  opacity: 0.7;
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const PlayerRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;

const PlayerNameContainer = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const PlayerName = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
`;

const PlayerIndicator = styled.span`
  display: flex;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
`;

const CaptainStar = styled.span`
  font-size: 12px;
  line-height: 1;
`;

const PlayerValue = styled.span`
  opacity: 0.7;
`;

type TimerInfo = {
  label: string;
  time: string;
};

const getMainTimer = (
  timers: Entity[],
  players: readonly Player[],
  lobbySettings: ReturnType<typeof lobbySettingsVar>,
  practice: boolean,
): TimerInfo | null => {
  if (practice) return { label: "Practice", time: "" };

  if (lobbySettings.mode === "switch") {
    const leader = players.reduce((a, b) =>
      (a.sheepTime ?? 0) >= (b.sheepTime ?? 0) ? a : b
    );
    const remaining = lobbySettings.time - (leader.sheepTime ?? 0);
    return {
      label: leader.name ?? "",
      time: formatDuration(remaining * 1000, remaining < 10),
    };
  }

  const buff = timers[0]?.buffs?.[0];
  return {
    label: buff?.expiration ?? "",
    time: formatDuration((buff?.remainingDuration ?? 0) * 1000),
  };
};

type PlayerNameWithIndicatorProps = {
  player: Player;
  captains: readonly string[] | undefined;
  vipId: string | undefined;
  isCaptainsMode: boolean;
};

const PlayerNameWithIndicator = (
  { player, captains, vipId, isCaptainsMode }: PlayerNameWithIndicatorProps,
) => {
  const isCaptain = captains?.includes(player.id);
  const isVip = player.id === vipId;

  return (
    <PlayerNameContainer>
      {isCaptainsMode && isCaptain && <CaptainStar>⭐</CaptainStar>}
      {!isCaptainsMode && isVip && (
        <PlayerIndicator>
          <SvgIcon icon="vip" accentColor={player.playerColor ?? undefined} />
        </PlayerIndicator>
      )}
      <PlayerName $color={player.playerColor ?? "#FFFFFF"}>
        {player.name ?? "Unknown"}
      </PlayerName>
    </PlayerNameContainer>
  );
};

type ScoreboardProps = {
  players: readonly Player[];
  practice: boolean;
  lobbySettings: ReturnType<typeof lobbySettingsVar>;
};

const Scoreboard = (
  { players, practice, lobbySettings }: ScoreboardProps,
) => {
  const spirits = useReactiveVar(spiritsVar);
  const structuresByOwner = useReactiveVar(structuresByOwnerVar);
  const captainsDraft = useReactiveVar(captainsDraftVar);
  const vipId = useReactiveVar(vipVar);

  const isCaptainsMode = !!captainsDraft;
  const captains = captainsDraft?.captains;

  if (practice) {
    return (
      <Body>
        {players.map((p) => (
          <PlayerRow key={p.id}>
            <PlayerNameWithIndicator
              player={p}
              captains={captains}
              vipId={vipId}
              isCaptainsMode={isCaptainsMode}
            />
          </PlayerRow>
        ))}
      </Body>
    );
  }

  if (lobbySettings.mode === "switch") {
    const sortedPlayers = [...players]
      .filter((p) => p.team === "sheep" || p.team === "wolf")
      .sort((a, b) => (a.sheepTime ?? 0) - (b.sheepTime ?? 0));

    return (
      <Body>
        {sortedPlayers.map((p) => {
          const remaining = lobbySettings.time - (p.sheepTime ?? 0);
          return (
            <PlayerRow key={p.id}>
              <PlayerName $color={p.playerColor ?? "#FFFFFF"}>
                {p.name ?? "Unknown"}
              </PlayerName>
              <PlayerValue>
                {formatDuration(remaining * 1000, remaining < 10)}
              </PlayerValue>
            </PlayerRow>
          );
        })}
      </Body>
    );
  }

  // Regular mode - group by teams
  const sheepPlayers = players.filter((p) => p.team === "sheep");
  const wolfPlayers = players.filter((p) => p.team === "wolf");
  const spiritOwnerIds = new Set(spirits.map((s) => s.owner));

  const aliveSheep = sheepPlayers.filter((p) => !spiritOwnerIds.has(p.id));
  const deadSheep = sheepPlayers.filter((p) => spiritOwnerIds.has(p.id));

  return (
    <Body>
      <TeamSection>
        <TeamHeader>Sheep</TeamHeader>
        {aliveSheep.map((p) => {
          const count = structuresByOwner[p.id]?.size ?? 0;
          return (
            <PlayerRow key={p.id}>
              <PlayerNameWithIndicator
                player={p}
                captains={captains}
                vipId={vipId}
                isCaptainsMode={isCaptainsMode}
              />
              {count > 0 && <PlayerValue>{count}</PlayerValue>}
            </PlayerRow>
          );
        })}
        {aliveSheep.length === 0 && <span>-</span>}
      </TeamSection>
      {deadSheep.length > 0 && (
        <TeamSection>
          <TeamHeader>Spirits</TeamHeader>
          {deadSheep.map((p) => (
            <PlayerRow key={p.id}>
              <PlayerNameWithIndicator
                player={p}
                captains={captains}
                vipId={vipId}
                isCaptainsMode={isCaptainsMode}
              />
            </PlayerRow>
          ))}
        </TeamSection>
      )}
      <TeamSection>
        <TeamHeader>Wolves</TeamHeader>
        {wolfPlayers.map((p) => (
          <PlayerRow key={p.id}>
            <PlayerNameWithIndicator
              player={p}
              captains={captains}
              vipId={vipId}
              isCaptainsMode={isCaptainsMode}
            />
          </PlayerRow>
        ))}
        {wolfPlayers.length === 0 && <span>-</span>}
      </TeamSection>
    </Body>
  );
};

export const GameStatusPanel = () => {
  const timers = useReactiveVar(timersVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const practice = useReactiveVar(practiceVar);
  const shortcuts = useReactiveVar(shortcutsVar);
  const players = usePlayers();
  const expanded = useReactiveVar(scoreboardExpandedVar);
  const isEditor = useReactiveVar(editorVar);

  const localPlayer = useLocalPlayer();

  useListenToEntities(players, ["sheepTime", "team"]);

  useEffect(() => {
    const binding = shortcuts.misc?.toggleScoreboard ?? ["Tab"];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (binding.includes(e.code)) {
        e.preventDefault();
        scoreboardExpandedVar(!scoreboardExpandedVar());
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  if (isEditor) return null;

  const mainTimer = getMainTimer(timers, players, lobbySettings, practice);
  if (!mainTimer) return null;
  const hasPlayers = players.length > 0;
  const forceExpanded = mainTimer.label === "Time until sheep spawn:" ||
    (localPlayer?.team === "wolf" &&
      mainTimer.label === "Time until wolves spawn:");
  const showScoreboard = (expanded || forceExpanded) && hasPlayers;

  return (
    <Container>
      <Header
        $clickable={hasPlayers}
        onClick={hasPlayers
          ? () => scoreboardExpandedVar(!expanded)
          : undefined}
      >
        <span>{mainTimer.label}</span>
        {mainTimer.time && <span>{mainTimer.time}</span>}
        {hasPlayers && (
          <ExpandIndicator
            $expanded={expanded || forceExpanded}
          />
        )}
      </Header>
      {showScoreboard && (
        <Scoreboard
          players={players}
          practice={practice}
          lobbySettings={lobbySettings}
        />
      )}
    </Container>
  );
};
