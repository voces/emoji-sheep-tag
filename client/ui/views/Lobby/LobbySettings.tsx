import { styled } from "npm:styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer } from "@/vars/players.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../client.ts";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { TimeInput } from "@/components/forms/TimeInput.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";

const SettingsCard = styled(Card)`
  width: 40%;
  justify-content: space-between;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const GameSettingsContainer = styled(VStack)`
  gap: 12px;
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
          <SettingsLabel htmlFor="time">
            Round Duration
          </SettingsLabel>
          <HStack $align="center">
            <TimeInput
              id="time"
              min={1}
              max={3599}
              value={lobbySettings.time}
              onChange={(value) => send({ type: "lobbySettings", time: value })}
              disabled={!localPlayer?.host || lobbySettings.autoTime}
              style={{ flex: 1 }}
            />
            <SettingsLabel htmlFor="autoTime">Auto</SettingsLabel>
            <Checkbox
              id="autoTime"
              checked={lobbySettings.autoTime}
              onChange={(e) =>
                send({
                  type: "lobbySettings",
                  time: e.currentTarget.checked ? "auto" : lobbySettings.time,
                })}
              disabled={!localPlayer?.host}
            />
          </HStack>
        </SettingsRow>

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

      <GameSettingsContainer>
        <Button
          type="button"
          onClick={() => send({ type: "start", practice: true })}
          disabled={!localPlayer?.host}
        >
          Practice
        </Button>
        <Button
          type="button"
          onClick={() => send({ type: "start" })}
          disabled={!localPlayer?.host}
        >
          Start
        </Button>
      </GameSettingsContainer>
    </SettingsCard>
  );
};
