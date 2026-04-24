import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer, usePlayer } from "@/hooks/usePlayers.ts";
import { Entity } from "../../../ecs.ts";
import { lookup } from "../../../systems/lookup.ts";
import { useListenToEntityProp } from "@/hooks/useListenToEntityProp.ts";
import { editorVar } from "@/vars/editor.ts";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { primaryUnitVar } from "@/vars/primaryUnit.ts";
import { getDistanceMultiplier } from "@/shared/penAreas.ts";
import {
  getEffectivePlayerGold,
  isTeamGoldEnabled,
} from "../../../api/player.ts";
import { selection } from "../../../systems/selection.ts";
import { useSet } from "@/hooks/useSet.ts";

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 10px;
  box-shadow: ${({ theme }) => theme.shadow.md};
  pointer-events: auto;
`;

const GoldValue = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.hi};
`;

const GoldIcon = styled.span`
  color: ${({ theme }) => theme.game.gold};
  display: inline-grid;
  place-items: center;
`;

const TooltipContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
`;

const SheepTooltip = () => {
  const { t } = useTranslation();
  const primaryUnit = useReactiveVar(primaryUnitVar);
  const multiplier = useListenToEntityProp(
    primaryUnit,
    "position",
    (p) => p ? getDistanceMultiplier(p.x, p.y).toFixed(2) : undefined,
  );

  return (
    <TooltipContent>
      <div>{t("hud.goldSheepTooltip")}</div>
      {multiplier && <div>{t("hud.goldSheepMultiplier", { multiplier })}</div>}
    </TooltipContent>
  );
};

const WolfTooltip = () => {
  const { t } = useTranslation();
  return (
    <TooltipContent>
      <div>{t("hud.goldWolfTooltip")}</div>
    </TooltipContent>
  );
};

const useGoldTooltip = (team: string | undefined) => {
  if (team === "wolf") return <WolfTooltip />;
  if (team === "sheep") return <SheepTooltip />;
  return null;
};

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

const InnerGold = (
  { entity, team }: { entity: Entity; team: string | undefined },
) => {
  const validTeam = team === "wolf" || team === "sheep" ? team : undefined;
  const teamGoldEnabled = isTeamGoldEnabled(validTeam);

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
      <GoldIcon>
        <span style={{ width: 16, height: 16 }}>
          <SvgIcon icon="gold" />
        </span>
      </GoldIcon>
      <GoldValue>{displayGold}</GoldValue>
      {tooltip}
    </Container>
  );
};

export const Gold = () => {
  const editor = useReactiveVar(editorVar);
  const player = useLocalPlayer();

  // For observers, track selection to show selected entity's owner gold
  useSet(selection);
  const selectedEntity = selection.first();
  const selectedOwnerId = selectedEntity?.owner;
  const selectedOwner = usePlayer(
    player?.team === "observer" ? selectedOwnerId : undefined,
  );

  // Listen to selected entity's owner changes
  useListenToEntityProp(
    player?.team === "observer" ? selectedEntity : undefined,
    "owner",
  );

  if (!player || editor) return null;

  // Observer viewing a selected entity's owner gold
  if (player.team === "observer" && selectedOwner) {
    return <InnerGold entity={selectedOwner} team={selectedOwner.team} />;
  }

  return <InnerGold entity={player} team={player.team} />;
};
