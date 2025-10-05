import { styled } from "styled-components";
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
import { useEffect, useState } from "react";
import { playersVar } from "@/vars/players.ts";

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
  const players = useReactiveVar(playersVar);

  const [sheepIncome, setSheepIncome] = useState(
    lobbySettings.income.sheep.toString(),
  );
  useEffect(() => setSheepIncome(lobbySettings.income.sheep.toString()), [
    lobbySettings.income.sheep,
  ]);

  const [wolfIncome, setWolfIncome] = useState(
    lobbySettings.income.wolves.toString(),
  );
  useEffect(() => setWolfIncome(lobbySettings.income.wolves.toString()), [
    lobbySettings.income.wolves,
  ]);

  const maxSheep = Math.max(players.length - 1, 1);

  return (
    <SettingsCard>
      <GameSettingsContainer>
        <SettingsHeader>
          Game Settings
        </SettingsHeader>

        <SettingsRow>
          <SettingsLabel htmlFor="sheep">
            Sheep Count
          </SettingsLabel>
          <HStack $align="center">
            <SettingsInput
              id="sheep"
              type="number"
              min={1}
              max={maxSheep}
              value={lobbySettings.sheep}
              onChange={(e) => {
                const value = Math.max(
                  1,
                  Math.min(maxSheep, parseInt(e.target.value) || 1),
                );
                send({ type: "lobbySettings", sheep: value });
              }}
              disabled={!localPlayer?.host || lobbySettings.autoSheep}
              style={{ flex: 1 }}
            />
            <SettingsLabel htmlFor="autoSheep">Auto</SettingsLabel>
            <Checkbox
              id="autoSheep"
              checked={lobbySettings.autoSheep}
              onChange={(e) =>
                send({
                  type: "lobbySettings",
                  sheep: e.currentTarget.checked ? "auto" : lobbySettings.sheep,
                })}
              disabled={!localPlayer?.host}
            />
          </HStack>
        </SettingsRow>

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

        <SettingsRow>
          <SettingsLabel htmlFor="sheep-income">
            Income Rate - Sheep
          </SettingsLabel>
          <SettingsInput
            id="sheep-income"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={sheepIncome}
            onChange={(e) => {
              if (!e.currentTarget.value) return setSheepIncome("");
              const value = Math.round(
                Math.max(
                  0,
                  Math.min(100, parseFloat(e.currentTarget.value) || 0),
                ) * 100,
              ) / 100;
              send({
                type: "lobbySettings",
                income: {
                  ...lobbySettings.income,
                  sheep: value,
                },
              });
            }}
            onBlur={(e) => {
              if (e.currentTarget.value === "") {
                setSheepIncome("1");
                send({
                  type: "lobbySettings",
                  income: { ...lobbySettings.income, sheep: 1 },
                });
              }
            }}
            disabled={!localPlayer?.host}
          />
        </SettingsRow>

        <SettingsRow>
          <SettingsLabel htmlFor="wolves-income">
            Income Rate - Wolves
          </SettingsLabel>
          <SettingsInput
            id="wolves-income"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={wolfIncome}
            onChange={(e) => {
              if (!e.currentTarget.value) return setWolfIncome("");
              const value = Math.round(
                Math.max(
                  0,
                  Math.min(100, parseFloat(e.currentTarget.value) || 0),
                ) * 100,
              ) / 100;
              send({
                type: "lobbySettings",
                income: {
                  ...lobbySettings.income,
                  wolves: value,
                },
              });
            }}
            onBlur={(e) => {
              if (e.currentTarget.value === "") {
                setWolfIncome("1");
                send({
                  type: "lobbySettings",
                  income: { ...lobbySettings.income, wolves: 1 },
                });
              }
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
