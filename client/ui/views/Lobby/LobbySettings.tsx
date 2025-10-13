import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer } from "@/vars/players.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../client.ts";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { TimeInput } from "@/components/forms/TimeInput.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { playersVar } from "@/vars/players.ts";
import { NumericSettingInput } from "./NumericSettingInput.tsx";

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

export const LobbySettings = () => {
  const localPlayer = useLocalPlayer();
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const players = useReactiveVar(playersVar);

  const maxSheep = Math.max(players.length - 1, 1);

  return (
    <SettingsCard>
      <GameSettingsContainer>
        <SettingsHeader>
          Game Settings
        </SettingsHeader>

        <NumericSettingInput
          id="sheep"
          label="Sheep Count"
          value={lobbySettings.sheep}
          min={1}
          max={maxSheep}
          step={1}
          defaultValue="1"
          disabled={!localPlayer?.host}
          autoChecked={lobbySettings.autoSheep}
          onChange={(value) => send({ type: "lobbySettings", sheep: value })}
          onAutoChange={(checked) =>
            send({
              type: "lobbySettings",
              sheep: checked ? "auto" : lobbySettings.sheep,
            })}
        />

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

        <NumericSettingInput
          id="sheep-gold"
          label="Starting Gold - Sheep"
          value={lobbySettings.startingGold.sheep}
          min={0}
          max={100000}
          step={1}
          defaultValue="0"
          disabled={!localPlayer?.host}
          onChange={(value) =>
            send({
              type: "lobbySettings",
              startingGold: { ...lobbySettings.startingGold, sheep: value },
            })}
        />

        <NumericSettingInput
          id="wolves-gold"
          label="Starting Gold - Wolves"
          value={lobbySettings.startingGold.wolves}
          min={0}
          max={100000}
          step={1}
          defaultValue="0"
          disabled={!localPlayer?.host}
          onChange={(value) =>
            send({
              type: "lobbySettings",
              startingGold: { ...lobbySettings.startingGold, wolves: value },
            })}
        />

        <NumericSettingInput
          id="sheep-income"
          label="Income Rate - Sheep"
          value={lobbySettings.income.sheep}
          min={0}
          max={100}
          step={0.01}
          defaultValue="1"
          disabled={!localPlayer?.host}
          onChange={(value) =>
            send({
              type: "lobbySettings",
              income: { ...lobbySettings.income, sheep: value },
            })}
        />

        <NumericSettingInput
          id="wolves-income"
          label="Income Rate - Wolves"
          value={lobbySettings.income.wolves}
          min={0}
          max={100}
          step={0.01}
          defaultValue="1"
          disabled={!localPlayer?.host}
          onChange={(value) =>
            send({
              type: "lobbySettings",
              income: { ...lobbySettings.income, wolves: value },
            })}
        />
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
          disabled={!localPlayer?.host || players.length === 1}
        >
          Start
        </Button>
      </GameSettingsContainer>
    </SettingsCard>
  );
};
