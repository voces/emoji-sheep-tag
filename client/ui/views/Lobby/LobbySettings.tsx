import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useIsLocalPlayerHost, usePlayers } from "@/hooks/usePlayers.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { send } from "../../../client.ts";
import { HStack } from "@/components/layout/Layout.tsx";
import { TimeInput } from "@/components/forms/TimeInput.tsx";
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
import {
  ButtonGroup,
  GameSettingsContainer,
  ModeButton,
  SettingsCard,
  SettingsHeader,
  SettingsLabel,
  SettingsRow,
} from "./lobbyStyles.tsx";
import { StartButtons } from "./StartButtons.tsx";
import { TeamGoldSetting } from "./TeamGoldSetting.tsx";

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

export const LobbySettings = () => {
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const captainsDraft = useReactiveVar(captainsDraftVar);
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
      if (err instanceof Error && err.message === "IndexedDB not available") {
        setLocalMaps([]);
        return;
      }
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

  const shardOptions = useMemo(() => {
    const options = [{ value: "", label: "est.w3x.io" }];

    for (const s of lobbySettings.shards) {
      // For fly regions, show status indicator
      if (s.flyRegion) {
        const statusLabel = s.status === "launching" ? " (launching...)" : "";
        options.push({
          value: s.id,
          label: `fly.io (${s.region})${statusLabel}`,
        });
      } else if (s.isOnline) {
        // Regular shards - only show if online
        options.push({
          value: s.id,
          label: s.region ? `${s.name} (${s.region})` : s.name,
        });
      }
    }

    return options;
  }, [lobbySettings.shards]);

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

        {shardOptions.length > 1 && (
          <SettingsRow>
            <SettingsLabel htmlFor="shard-select">
              Server
            </SettingsLabel>
            <Select
              id="shard-select"
              value={lobbySettings.shard ?? ""}
              options={shardOptions}
              onChange={(shard) =>
                send({ type: "lobbySettings", shard: shard || null })}
              disabled={!isHost}
            />
          </SettingsRow>
        )}

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
            <ModeButton
              type="button"
              $active={lobbySettings.mode === "vamp"}
              onClick={() => send({ type: "lobbySettings", mode: "vamp" })}
              disabled={!isHost}
            >
              Vamp
            </ModeButton>
          </ButtonGroup>
        </SettingsRow>

        {lobbySettings.mode === "switch" && (
          <SettingsRow>
            <HStack $align="center" style={{ gap: "4px" }}>
              <Checkbox
                id="view"
                checked={lobbySettings.view}
                onChange={(e) =>
                  send({
                    type: "lobbySettings",
                    view: e.currentTarget.checked,
                  })}
                disabled={!isHost}
              />
              <SettingsLabel htmlFor="view">View (Disable Fog)</SettingsLabel>
            </HStack>
          </SettingsRow>
        )}

        {lobbySettings.mode === "survival" && (
          <TeamGoldSetting isHost={isHost} />
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
          <SettingsLabel htmlFor="time">Survival Time</SettingsLabel>
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
          tooltip="Multiplier on passive income."
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
          tooltip="Multiplier on passive income and kill bounties."
        />
      </GameSettingsContainer>

      <StartButtons
        buttonsDisabled={buttonsDisabled}
        isHost={isHost}
        nonObserversCount={nonObservers.length}
        captainsDraft={captainsDraft}
      />
    </SettingsCard>
  );
};
