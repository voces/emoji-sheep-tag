import { styled } from "styled-components";
import { Button } from "@/components/forms/Button.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { send } from "../../../client.ts";
import { GameSettingsContainer } from "./lobbyStyles.tsx";

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
}: {
  buttonsDisabled: boolean;
  isHost: boolean;
  nonObserversCount: number;
}) => {
  const { tooltipContainerProps: manualProps, tooltip: manualTooltip } =
    useTooltip<HTMLButtonElement>("Start with the current teams.");
  const { tooltipContainerProps: smartProps, tooltip: smartTooltip } =
    useTooltip<HTMLButtonElement>(
      "Randomize teams fairly based on past games.",
    );

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
          accessKey="r"
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
