import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../client.ts";
import { HStack } from "@/components/layout/Layout.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { SettingsLabel, SettingsRow } from "./lobbyStyles.tsx";

const TeamGoldTooltip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const TeamGoldSetting = ({ isHost }: { isHost: boolean }) => {
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const { tooltipContainerProps, tooltip } = useTooltip(
    <TeamGoldTooltip>
      <div>
        <strong>Sheep:</strong> Individual gold up to 20, rest shared with team.
      </div>
      <div>
        <strong>Wolves:</strong> All gold shared with team.
      </div>
    </TeamGoldTooltip>,
  );

  return (
    <SettingsRow>
      <HStack
        $align="center"
        style={{ gap: "4px" }}
        {...tooltipContainerProps}
      >
        <Checkbox
          id="teamGold"
          checked={lobbySettings.teamGold}
          onChange={(e) =>
            send({
              type: "lobbySettings",
              teamGold: e.currentTarget.checked,
            })}
          disabled={!isHost}
        />
        <SettingsLabel htmlFor="teamGold">Team Gold</SettingsLabel>
      </HStack>
      {tooltip}
    </SettingsRow>
  );
};
