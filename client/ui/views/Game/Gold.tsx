import { styled } from "styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { Entity } from "../../../ecs.ts";
import { lookup } from "../../../systems/lookup.ts";
import { useListenToEntityProp } from "@/hooks/useListenToEntityProp.ts";
import { editorVar } from "@/vars/editor.ts";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { primaryUnitVar } from "@/vars/primaryUnit.ts";
import { getDistanceMultiplier } from "@/shared/penAreas.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { getEffectivePlayerGold } from "../../../api/player.ts";

const Container = styled.div(({ theme }) => ({
  width: 100,
  display: "flex",
  gap: 4,
  alignItems: "center",
  color: theme.colors.gold,
  pointerEvents: "auto",
}));

const TooltipContent = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: 4,
});

const useGoldTooltip = (team: string | undefined) => {
  const primaryUnit = useReactiveVar(primaryUnitVar);
  const sheepUnit = team === "sheep" ? primaryUnit : undefined;
  const position = useListenToEntityProp(sheepUnit, "position");

  if (team === "wolf") {
    return (
      <TooltipContent>
        <div>Gold is generated over time and from destroying structures.</div>
      </TooltipContent>
    );
  }

  if (team === "sheep" && position) {
    const multiplier = getDistanceMultiplier(position.x, position.y);
    return (
      <TooltipContent>
        <div>Gold is generated over time based on distance from the pen.</div>
        <div>Current multiplier: {multiplier.toFixed(2)}x</div>
      </TooltipContent>
    );
  }

  return null;
};

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

const InnerGold = (
  { entity, team }: { entity: Entity; team: string | undefined },
) => {
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const validTeam = team === "wolf" || team === "sheep" ? team : undefined;
  const teamGoldEnabled = lobbySettings.mode === "vip" ||
    (lobbySettings.mode === "vamp" && validTeam === "wolf") ||
    (lobbySettings.mode === "survival" && lobbySettings.teamGold);

  // Listen to gold changes to trigger rerenders, flooring to avoid unnecessary rerenders
  useListenToEntityProp(entity, "gold", (g) => Math.floor(g ?? 0));

  // Get team entity for team gold display
  const teamEntityId = validTeam ? TEAM_ENTITY_IDS[validTeam] : undefined;
  const teamEntity = teamEntityId ? lookup(teamEntityId) : undefined;
  useListenToEntityProp(
    teamGoldEnabled ? teamEntity : undefined,
    "gold",
    (g) => Math.floor(g ?? 0),
  );

  const displayGold = Math.floor(getEffectivePlayerGold(entity.id));

  const tooltipContent = useGoldTooltip(team);
  const { tooltipContainerProps, tooltip } = useTooltip(tooltipContent);

  return (
    <Container {...tooltipContainerProps} data-game-ui>
      <span style={{ width: 24, height: 24 }}>
        <SvgIcon icon="gold" />
      </span>
      <span>{displayGold}</span>
      {tooltip}
    </Container>
  );
};

export const Gold = () => {
  const editor = useReactiveVar(editorVar);
  const player = useLocalPlayer();

  if (!player || editor) return null;

  return <InnerGold entity={player} team={player.team} />;
};
