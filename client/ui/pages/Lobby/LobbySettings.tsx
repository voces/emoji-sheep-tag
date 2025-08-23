import { styled } from "npm:styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer } from "@/vars/players.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../client.ts";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { Button } from "@/components/forms/Button.tsx";

const SettingsCard = styled(Card)`
  width: 40%;
  justify-content: space-between;
  display: flex;
  flex-direction: column;
`;

const GameSettingsContainer = styled(VStack)`
  gap: 12px;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const SettingsRow = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SettingsHeader = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: bold;
`;

const SettingsLabel = styled.label`
  font-size: 12px;
  font-weight: bold;
`;

const SettingsInput = styled(Input)`
  &:disabled {
    background-color: #f5f5f5;
    color: #666;
    cursor: not-allowed;
  }
`;

export const LobbySettings = () => {
  const localPlayer = useLocalPlayer();
  const lobbySettings = useReactiveVar(lobbySettingsVar);

  return (
    <SettingsCard>
      <GameSettingsContainer>
        <SettingsHeader>
          Game Settings
        </SettingsHeader>

        <SettingsRow>
          <SettingsLabel htmlFor="sheep-gold">
            Starting Gold - Sheep
          </SettingsLabel>
          <SettingsInput
            id="sheep-gold"
            type="number"
            min={0}
            max={100000}
            value={lobbySettings.startingGold.sheep}
            onChange={(e) => {
              const value = Math.max(
                0,
                Math.min(100000, parseInt(e.target.value) || 0),
              );
              send({
                type: "lobbySettings",
                startingGold: {
                  ...lobbySettings.startingGold,
                  sheep: value,
                },
              });
            }}
            disabled={!localPlayer?.host}
          />
        </SettingsRow>

        <SettingsRow>
          <SettingsLabel htmlFor="wolves-gold">
            Starting Gold - Wolves
          </SettingsLabel>
          <SettingsInput
            id="wolves-gold"
            type="number"
            min={0}
            max={100000}
            value={lobbySettings.startingGold.wolves}
            onChange={(e) => {
              const value = Math.max(
                0,
                Math.min(100000, parseInt(e.target.value) || 0),
              );
              send({
                type: "lobbySettings",
                startingGold: {
                  ...lobbySettings.startingGold,
                  wolves: value,
                },
              });
            }}
            disabled={!localPlayer?.host}
          />
        </SettingsRow>
      </GameSettingsContainer>

      <Button
        type="button"
        onClick={() => send({ type: "start" })}
        disabled={!localPlayer?.host}
      >
        Start
      </Button>
    </SettingsCard>
  );
};
