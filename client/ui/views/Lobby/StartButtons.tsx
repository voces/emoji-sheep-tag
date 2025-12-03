import { styled } from "styled-components";
import { Button } from "@/components/forms/Button.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { send } from "../../../client.ts";
import { GameSettingsContainer } from "./lobbyStyles.tsx";
import type { CaptainsDraft } from "../../../schemas.ts";

const StartButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;
`;

const SecondaryButton = styled(Button)`
  flex: 1;
`;

const TertiaryButton = styled(Button)`
  flex: 1;
`;

export const StartButtons = ({
  buttonsDisabled,
  isHost,
  nonObserversCount,
  captainsDraft,
}: {
  buttonsDisabled: boolean;
  isHost: boolean;
  nonObserversCount: number;
  captainsDraft: CaptainsDraft;
}) => {
  const isDrafted = captainsDraft?.phase === "drafted" ||
    captainsDraft?.phase === "reversed";

  const { tooltipContainerProps: manualProps, tooltip: manualTooltip } =
    useTooltip<HTMLButtonElement>("Start with the current teams.");
  const { tooltipContainerProps: smartProps, tooltip: smartTooltip } =
    useTooltip<HTMLButtonElement>(
      "Randomize teams fairly based on past games.",
    );
  const { tooltipContainerProps: captainsProps, tooltip: captainsTooltip } =
    useTooltip<HTMLButtonElement>(
      "Select two captains who will draft teams.",
    );
  const { tooltipContainerProps: reverseProps, tooltip: reverseTooltip } =
    useTooltip<HTMLButtonElement>("Swap sheep and wolf teams.");

  if (isDrafted) {
    return (
      <GameSettingsContainer>
        <StartButtonRow>
          <SecondaryButton
            type="button"
            accessKey="r"
            onClick={() => send({ type: "reverseTeams" })}
            disabled={buttonsDisabled || !isHost || nonObserversCount < 2}
            {...reverseProps}
          >
            Reverse
          </SecondaryButton>
          {reverseTooltip}
          <TertiaryButton
            type="button"
            accessKey="a"
            onClick={() => send({ type: "start", fixedTeams: false })}
            disabled={buttonsDisabled || !isHost || nonObserversCount < 2}
            {...smartProps}
          >
            Smart
          </TertiaryButton>
          {smartTooltip}
          <TertiaryButton
            type="button"
            accessKey="p"
            onClick={() => send({ type: "start", practice: true })}
            disabled={buttonsDisabled || !isHost || nonObserversCount < 1}
          >
            Practice
          </TertiaryButton>
        </StartButtonRow>

        <Button
          type="button"
          accessKey="s"
          onClick={() => send({ type: "start", fixedTeams: true })}
          disabled={buttonsDisabled || !isHost || nonObserversCount < 2}
          {...manualProps}
        >
          Start
        </Button>
        {manualTooltip}
      </GameSettingsContainer>
    );
  }

  return (
    <GameSettingsContainer>
      <StartButtonRow>
        <SecondaryButton
          type="button"
          accessKey="a"
          onClick={() => send({ type: "start", fixedTeams: true })}
          disabled={buttonsDisabled || !isHost || nonObserversCount < 2}
          {...manualProps}
        >
          Manual
        </SecondaryButton>
        {manualTooltip}
        <TertiaryButton
          type="button"
          accessKey="c"
          onClick={() => send({ type: "startCaptains" })}
          disabled={buttonsDisabled || !isHost || nonObserversCount < 3}
          {...captainsProps}
        >
          Captains
        </TertiaryButton>
        {captainsTooltip}
        <TertiaryButton
          type="button"
          accessKey="p"
          onClick={() => send({ type: "start", practice: true })}
          disabled={buttonsDisabled || !isHost || nonObserversCount < 1}
        >
          Practice
        </TertiaryButton>
      </StartButtonRow>

      <Button
        type="button"
        accessKey="s"
        onClick={() => send({ type: "start", fixedTeams: false })}
        disabled={buttonsDisabled || !isHost || nonObserversCount < 2}
        {...smartProps}
      >
        Smart Draft
      </Button>
      {smartTooltip}
    </GameSettingsContainer>
  );
};
