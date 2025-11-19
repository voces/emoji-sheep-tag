import { styled } from "styled-components";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useIsLocalPlayerHost, usePlayers } from "@/hooks/usePlayers.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../client.ts";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { TimeInput } from "@/components/forms/TimeInput.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { NumericSettingInput } from "./NumericSettingInput.tsx";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { Select } from "@/components/forms/Select.tsx";
import {
  listLocalMaps,
  type LocalMapMetadata,
} from "../../../storage/localMaps.ts";
import { uploadAndSelectCustomMap } from "../../../actions/uploadCustomMap.ts";
import { localMapsRefreshVar } from "@/vars/localMapsRefresh.ts";

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

const SettingsCard = styled(Card)`
  width: 40%;
  justify-content: space-between;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const GameSettingsContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.md};
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

const ButtonGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
`;

const ModeButton = styled(Button)<{ $active: boolean }>`
  flex: 1;
  border-radius: 0;
  border: none;
  background: ${({ $active, theme }) =>
    $active
      ? theme.colors.body
      : `hsl(from ${theme.colors.body} h s calc(l - 20))`};

  &:not(:last-child) {
    border-right: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:hover:not([disabled]) {
    background: ${({ theme }) => theme.colors.body};
    box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  }

  &:disabled {
    background: ${({ $active, theme }) =>
      $active
        ? `hsl(from ${theme.colors.body} h s calc(l - 20))`
        : `hsl(from ${theme.colors.body} h s calc(l - 30))`};
  }
`;

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

export const LobbySettings = () => {
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const players = usePlayers();
  useListenToEntities(players, ["team"]);
  const isHost = useIsLocalPlayerHost();
  const [buttonsDisabled, setButtonsDisabled] = useState(true);
  const [localMaps, setLocalMaps] = useState<LocalMapMetadata[]>([]);
  const refreshTrigger = useReactiveVar(localMapsRefreshVar);

  useEffect(() => {
    listLocalMaps().then((maps) => {
      setLocalMaps(maps);
    }).catch((err) => {
      console.error("Failed to load local maps:", err);
      setLocalMaps([]);
    });
  }, [refreshTrigger]);

  const mapOptions = useMemo(
    () => [
      ...MAPS.map((map) => ({ value: map.id, label: map.name })),
      ...localMaps.map((map) => ({
        value: `local:${map.id}`,
        label: `${map.name} - ${map.author}, ${formatDate(map.timestamp)}`,
      })),
    ],
    [localMaps],
  );

  // Filter out observers and pending players
  const nonObservers = players.filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );

  const maxSheep = Math.max(nonObservers.length - 1, 1);

  useLayoutEffect(() => {
    const timeout = setTimeout(() => setButtonsDisabled(false), 250);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <SettingsCard>
      <GameSettingsContainer>
        <SettingsHeader>
          Game Settings
        </SettingsHeader>

        <SettingsRow>
          <SettingsLabel htmlFor="mode">
            Mode
          </SettingsLabel>
          <ButtonGroup>
            <ModeButton
              type="button"
              $active={lobbySettings.mode === "survival"}
              onClick={() => send({ type: "lobbySettings", mode: "survival" })}
              disabled={!isHost}
            >
              Survival
            </ModeButton>
            <ModeButton
              type="button"
              $active={lobbySettings.mode === "vip"}
              onClick={() => send({ type: "lobbySettings", mode: "vip" })}
              disabled={!isHost}
            >
              VIP
            </ModeButton>
            <ModeButton
              type="button"
              $active={lobbySettings.mode === "switch"}
              onClick={() => send({ type: "lobbySettings", mode: "switch" })}
              disabled={!isHost}
            >
              Switch
            </ModeButton>
          </ButtonGroup>
        </SettingsRow>

        {/* TODO: remove this if once we have multiple maps */}
        {mapOptions.length > 1 && (
          <SettingsRow>
            <SettingsLabel htmlFor="map-select">
              Map
            </SettingsLabel>
            <Select
              id="map-select"
              value={lobbySettings.map}
              options={mapOptions}
              onChange={(map) => {
                if (map.startsWith("local:")) {
                  const localId = map.replace("local:", "");
                  uploadAndSelectCustomMap(localId).catch((err) => {
                    console.error("Failed to upload custom map:", err);
                  });
                } else {
                  send({ type: "lobbySettings", map });
                }
              }}
              disabled={!isHost}
            />
          </SettingsRow>
        )}

        {lobbySettings.mode === "vip" && (
          <NumericSettingInput
            id="vip-handicap"
            label="Guard Handicap"
            value={lobbySettings.vipHandicap}
            min={0.01}
            max={10}
            step={0.01}
            defaultValue="0.75"
            disabled={!isHost}
            onChange={(value) =>
              send({ type: "lobbySettings", vipHandicap: value })}
          />
        )}

        <NumericSettingInput
          id="sheep"
          label="Sheep Count"
          value={lobbySettings.sheep}
          min={1}
          max={maxSheep}
          step={1}
          defaultValue="1"
          disabled={!isHost}
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
              disabled={!isHost || lobbySettings.autoTime}
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
              disabled={!isHost}
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
          disabled={!isHost}
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
          disabled={!isHost}
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
          disabled={!isHost}
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
          disabled={!isHost}
          onChange={(value) =>
            send({
              type: "lobbySettings",
              income: { ...lobbySettings.income, wolves: value },
            })}
        />

        <SettingsRow>
          <HStack $align="center" style={{ gap: "4px" }}>
            <Checkbox
              id="view"
              checked={lobbySettings.view}
              onChange={(e) =>
                send({ type: "lobbySettings", view: e.currentTarget.checked })}
              disabled={!isHost}
            />
            <SettingsLabel htmlFor="view">View (Disable Fog)</SettingsLabel>
          </HStack>
        </SettingsRow>
      </GameSettingsContainer>

      <GameSettingsContainer>
        <StartButtonRow>
          <SecondaryButton
            type="button"
            accessKey="a"
            onClick={() => send({ type: "start", fixedTeams: true })}
            disabled={buttonsDisabled || !isHost || nonObservers.length < 2}
          >
            Manual
          </SecondaryButton>
          <TertiaryButton
            type="button"
            accessKey="r"
            onClick={() => send({ type: "start", practice: true })}
            disabled={buttonsDisabled || !isHost || nonObservers.length < 1}
          >
            Practice
          </TertiaryButton>
        </StartButtonRow>

        <Button
          type="button"
          accessKey="s"
          onClick={() => send({ type: "start", fixedTeams: false })}
          disabled={buttonsDisabled || !isHost || nonObservers.length < 2}
        >
          Smart Draft
        </Button>
      </GameSettingsContainer>
    </SettingsCard>
  );
};
