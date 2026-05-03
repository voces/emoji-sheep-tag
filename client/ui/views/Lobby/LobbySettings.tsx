import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useIsLocalPlayerHost, usePlayers } from "@/hooks/usePlayers.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { send } from "../../../messaging.ts";
import { NumericSettingInput } from "./NumericSettingInput.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { Toggle } from "@/components/forms/Toggle.tsx";
import { TimeInput } from "@/components/forms/TimeInput.tsx";
import { PercentInput } from "@/components/forms/PercentInput.tsx";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { getMapManifestTags, MAPS } from "@/shared/maps/manifest.ts";
import { mapMatchesMode } from "@/shared/maps/tags.ts";
import {
  listLocalMaps,
  type LocalMapMetadata,
} from "../../../storage/localMaps.ts";
import { Select } from "@/components/forms/Select.tsx";
import { uploadAndSelectCustomMap } from "../../../actions/uploadCustomMap.ts";
import { localMapsRefreshVar } from "@/vars/localMapsRefresh.ts";
import { Panel } from "@/components/Panel.tsx";
import {
  Segment,
  SegmentedControl,
} from "@/components/forms/SegmentedControl.tsx";
import { Tag } from "@/components/Tag.tsx";
import { DEFAULT_VIP_HANDICAP } from "@/shared/constants.ts";
import { getDefaultIncome, getDefaultStartingGold } from "@/shared/round.ts";
import { Check, ChevronDown, ChevronRight, Map, RotateCcw } from "lucide-react";
import { Minimap } from "@/components/Minimap/index.tsx";

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  min-height: 0;
`;

const MapCard = styled(Panel)`
`;

const MapPreview = styled.div`
  display: flex;
  justify-content: center;
  background: ${({ theme }) => theme.surface[0]};
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.lg} ${({ theme }) =>
    theme.radius.lg} 0 0;
`;

const MapSelector = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${({ theme }) => theme.space[3]};
  background: transparent;
  border: none;
  border-radius: 0 0 ${({ theme }) => theme.radius.lg} ${({ theme }) =>
    theme.radius.lg};
  color: ${({ theme }) => theme.ink.hi};
  text-align: left;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &[disabled] {
    cursor: default;
  }

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const MapSelectorLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const MapName = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
`;

const MapChevron = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  display: flex;
  align-items: center;
`;

const MapDropdownOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
`;

const MapDropdown = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  padding: ${({ theme }) => theme.space[1]};
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const MapDropdownItem = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  background: ${({ $selected, theme }) =>
    $selected ? theme.surface[2] : "transparent"};
  border: none;
  color: ${({ theme }) => theme.ink.mid};
  padding: 8px ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.xs};
  font-size: ${({ theme }) => theme.text.sm};
  text-align: left;
  cursor: pointer;
  width: 100%;
  transition: background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const MapDropdownLabel = styled.span`
  flex: 1;
`;

const MapTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
`;

const HostPanel = styled(Panel)<{ $expanded: boolean }>`
  display: flex;
  flex-direction: column;
  ${({ $expanded }) => $expanded && "flex: 1; min-height: 0;"};
`;

const HostHead = styled.button<{ $expanded: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: ${({ $expanded, theme }) =>
    $expanded ? `${theme.radius.lg} ${theme.radius.lg} 0 0` : theme.radius.lg};
  color: ${({ theme }) => theme.ink.hi};
  text-align: left;
  cursor: pointer;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const HostTitle = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
`;

const HostHint = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.ink.lo};
`;

const HostBody = styled.div`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[4]} ${(
    { theme },
  ) => theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  overflow-y: auto;
  min-height: 0;
`;

const HostRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HostRow2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
`;

const Label = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ResetButton = styled.button`
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: ${({ theme }) => theme.radius.xs};
  border: none;
  background: ${({ theme }) => theme.surface[3]};
  color: ${({ theme }) => theme.ink.lo};
  cursor: pointer;
  padding: 0;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const ClearableTimeField = ({
  label,
  value,
  isAuto,
  disabled,
  onChange,
  onResetToAuto,
}: {
  label: string;
  value: number;
  isAuto: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
  onResetToAuto: () => void;
}) => (
  <HostRow>
    <Label>{label}</Label>
    <InputWrapper>
      <TimeInput
        min={1}
        max={3599}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          ...(!isAuto ? { paddingRight: 28 } : {}),
          ...(isAuto ? { opacity: 0.5 } : {}),
        }}
      />
      {!isAuto && (
        <ResetButton
          type="button"
          onClick={onResetToAuto}
          title="Reset to auto"
        >
          <RotateCcw size={12} />
        </ResetButton>
      )}
    </InputWrapper>
  </HostRow>
);

const ClearablePercentField = ({
  id,
  label,
  value,
  defaultValue,
  min,
  max,
  disabled,
  onChange,
  tooltip: tooltipContent,
}: {
  id: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
  tooltip?: React.ReactNode;
}) => {
  const { tooltipContainerProps, tooltip } = useTooltip<HTMLLabelElement>(
    tooltipContent,
  );
  const isDefault = value === defaultValue;
  return (
    <HostRow>
      <Label htmlFor={id} {...tooltipContainerProps}>
        {label}
        {tooltip}
      </Label>
      <InputWrapper>
        <PercentInput
          id={id}
          value={value}
          min={min}
          max={max}
          onChange={onChange}
          disabled={disabled}
          style={{
            ...(!isDefault ? { paddingRight: 28 } : {}),
            ...(isDefault ? { opacity: 0.5 } : {}),
          }}
        />
        {!isDefault && (
          <ResetButton
            type="button"
            onClick={() => onChange(defaultValue)}
            title="Reset to default"
          >
            <RotateCcw size={12} />
          </ResetButton>
        )}
      </InputWrapper>
    </HostRow>
  );
};

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString();

export const LobbySettings = () => {
  const { t } = useTranslation();
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const players = usePlayers();
  useListenToEntities(players, ["team"]);
  const isHost = useIsLocalPlayerHost();
  const [hostOpen, setHostOpen] = useState(false);
  const [localMaps, setLocalMaps] = useState<LocalMapMetadata[]>([]);
  const refreshTrigger = useReactiveVar(localMapsRefreshVar);

  useEffect(() => {
    listLocalMaps().then(setLocalMaps).catch((err) => {
      if (err instanceof Error && err.message === "IndexedDB not available") {
        setLocalMaps([]);
        return;
      }
      console.error("Failed to load local maps:", err);
      setLocalMaps([]);
    });
  }, [refreshTrigger]);

  const mapOptions = useMemo(
    () =>
      [
        ...MAPS.map((map) => ({
          value: map.id,
          label: map.name,
          tags: getMapManifestTags(map),
        })),
        ...localMaps.map((map) => ({
          value: `local:${map.id}`,
          label: `${map.name} - ${map.author}, ${formatDate(map.timestamp)}`,
          tags: map.tags,
        })),
      ].filter((opt) => mapMatchesMode(opt.tags, lobbySettings.mode)),
    [localMaps, lobbySettings.mode],
  );

  const shardOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const s of lobbySettings.shards) {
      if (s.flyRegion) {
        options.push({ value: s.id, label: `fly.io (${s.region})` });
      } else if (s.status === "online" || s.status === "suspended") {
        options.push({
          value: s.id,
          label: s.region ? `${s.name} (${s.region})` : s.name,
        });
      }
    }
    return options;
  }, [lobbySettings.shards]);

  const isShardLaunching = useMemo(() => {
    if (!lobbySettings.shard) return false;
    const shard = lobbySettings.shards.find((s) =>
      s.id === lobbySettings.shard
    );
    return shard?.status === "launching";
  }, [lobbySettings.shard, lobbySettings.shards]);

  const nonObservers = players.filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );
  const maxSheep = Math.max(nonObservers.length - 1, 1);
  const settingsDisabled = !isHost || isShardLaunching;
  const sheepConfigurable = nonObservers.length > 0;

  // Mode-aware defaults for gold/income — bulldog scales with team sizes.
  const wolfCount = Math.max(nonObservers.length - lobbySettings.sheep, 1);
  const defaultGold = getDefaultStartingGold(
    lobbySettings.mode,
    lobbySettings.sheep,
    wolfCount,
  );
  const defaultIncome = getDefaultIncome(
    lobbySettings.mode,
    lobbySettings.sheep,
    wolfCount,
  );

  const selectedMap = MAPS.find((m) => m.id === lobbySettings.map) ??
    (lobbySettings.map?.startsWith("local:")
      ? localMaps.find((m) => `local:${m.id}` === lobbySettings.map)
      : undefined);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const mapButtonRef = useRef<HTMLButtonElement>(null);

  const handleMapSelect = (mapId: string) => {
    if (mapId.startsWith("local:")) {
      const localId = mapId.replace("local:", "");
      uploadAndSelectCustomMap(localId).catch((err) =>
        console.error("Failed to upload custom map:", err)
      );
    } else {
      send({ type: "lobbySettings", map: mapId });
    }
    setMapMenuOpen(false);
  };

  return (
    <Sidebar>
      <MapCard>
        <MapPreview>
          <Minimap showCameraBox={false} interactive={false} disableFog />
        </MapPreview>
        <MapSelector
          ref={mapButtonRef}
          onClick={() => !settingsDisabled && setMapMenuOpen(!mapMenuOpen)}
          disabled={settingsDisabled}
        >
          <MapSelectorLeft>
            <Map size={14} />
            <MapName>{selectedMap?.name ?? lobbySettings.map}</MapName>
          </MapSelectorLeft>
          {!settingsDisabled && (
            <MapChevron>
              <ChevronDown size={14} />
            </MapChevron>
          )}
        </MapSelector>
        {mapMenuOpen && mapButtonRef.current && createPortal(
          (() => {
            const rect = mapButtonRef.current!.getBoundingClientRect();
            return (
              <>
                <MapDropdownOverlay onClick={() => setMapMenuOpen(false)} />
                <MapDropdown
                  style={{
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                  }}
                >
                  {mapOptions.map((opt) => (
                    <MapDropdownItem
                      key={opt.value}
                      $selected={opt.value === lobbySettings.map}
                      onClick={() => handleMapSelect(opt.value)}
                    >
                      {opt.value === lobbySettings.map && <Check size={14} />}
                      <MapDropdownLabel>{opt.label}</MapDropdownLabel>
                      {opt.tags.length > 0 && (
                        <MapTags>
                          {opt.tags.map((tag) => (
                            <Tag key={tag}>
                              {t(`mapTag.${tag}`, { defaultValue: tag })}
                            </Tag>
                          ))}
                        </MapTags>
                      )}
                    </MapDropdownItem>
                  ))}
                </MapDropdown>
              </>
            );
          })(),
          document.body,
        )}
      </MapCard>

      <HostPanel $expanded={hostOpen}>
        <HostHead $expanded={hostOpen} onClick={() => setHostOpen(!hostOpen)}>
          <HostTitle>{t("lobby.hostControls")}</HostTitle>
          <HostHint>
            <Tag>{t(`lobby.${lobbySettings.mode}`)}</Tag>
            {!lobbySettings.autoSheep && sheepConfigurable && (
              <Tag>
                {lobbySettings.sheep}v{nonObservers.length -
                  lobbySettings.sheep}
              </Tag>
            )}
            {!lobbySettings.autoTime && (
              <Tag>
                {Math.floor(lobbySettings.time / 60)}:
                {(lobbySettings.time % 60).toString().padStart(2, "0")}
              </Tag>
            )}
            {(lobbySettings.startingGold.sheep !== 0 ||
              lobbySettings.startingGold.wolves !== 0 ||
              lobbySettings.income.sheep !== 1 ||
              lobbySettings.income.wolves !== 1 ||
              lobbySettings.vipHandicap !== DEFAULT_VIP_HANDICAP ||
              !lobbySettings.teamGold ||
              lobbySettings.view) && <Tag>{t("lobby.customSettings")}</Tag>}
            {hostOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </HostHint>
        </HostHead>
        {hostOpen && (
          <HostBody>
            {shardOptions.length > 1 && (
              <HostRow>
                <Label htmlFor="shard-select">{t("lobby.server")}</Label>
                <Select
                  id="shard-select"
                  value={lobbySettings.shard ?? ""}
                  options={shardOptions}
                  onChange={(shard) =>
                    send({ type: "lobbySettings", shard: shard || null })}
                  disabled={settingsDisabled}
                />
              </HostRow>
            )}

            <HostRow>
              <Label>{t("lobby.mode")}</Label>
              <SegmentedControl
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  width: "100%",
                }}
              >
                {(["survival", "vip", "switch", "vamp", "bulldog"] as const)
                  .map((m) => (
                    <Segment
                      key={m}
                      $active={lobbySettings.mode === m}
                      onClick={() => send({ type: "lobbySettings", mode: m })}
                      disabled={settingsDisabled}
                      style={{ padding: "7px 6px" }}
                      title={t(`lobby.${m}Tooltip`)}
                    >
                      {t(`lobby.${m}`)}
                    </Segment>
                  ))}
              </SegmentedControl>
            </HostRow>

            {lobbySettings.mode === "switch" && (
              <Toggle
                checked={lobbySettings.view}
                onChange={(checked) =>
                  send({ type: "lobbySettings", view: checked })}
                disabled={settingsDisabled}
                isDefault={!lobbySettings.view}
                id="view"
              >
                {t("lobby.disableFog")}
              </Toggle>
            )}

            {lobbySettings.mode === "survival" && (
              <Toggle
                checked={lobbySettings.teamGold}
                onChange={(checked) =>
                  send({ type: "lobbySettings", teamGold: checked })}
                disabled={settingsDisabled}
                isDefault={lobbySettings.teamGold}
                id="teamGold"
                title={t("lobby.teamGoldTooltip")}
              >
                {t("lobby.teamGold")}
              </Toggle>
            )}

            {lobbySettings.mode === "vip" && (
              <ClearablePercentField
                id="vip-handicap"
                label={t("lobby.guardHandicap")}
                value={lobbySettings.vipHandicap}
                defaultValue={DEFAULT_VIP_HANDICAP}
                min={0.01}
                max={10}
                disabled={settingsDisabled}
                onChange={(value) =>
                  send({ type: "lobbySettings", vipHandicap: value })}
              />
            )}

            <HostRow2>
              <NumericSettingInput
                id="sheep"
                label={t("lobby.sheepCount")}
                value={lobbySettings.sheep}
                min={1}
                max={maxSheep}
                step={1}
                defaultValue="1"
                disabled={settingsDisabled}
                isAuto={lobbySettings.autoSheep || !sheepConfigurable}
                onResetToAuto={() =>
                  send({ type: "lobbySettings", sheep: "auto" })}
                onChange={(value) =>
                  send({ type: "lobbySettings", sheep: value })}
              />
              <ClearableTimeField
                label={t("lobby.survivalTime")}
                value={lobbySettings.time}
                isAuto={lobbySettings.autoTime}
                disabled={settingsDisabled}
                onChange={(value) =>
                  send({ type: "lobbySettings", time: value })}
                onResetToAuto={() =>
                  send({ type: "lobbySettings", time: "auto" })}
              />
            </HostRow2>

            <HostRow2>
              <NumericSettingInput
                id="sheep-gold"
                label={t("lobby.startingGoldSheep")}
                value={lobbySettings.startingGold.sheep}
                min={0}
                max={100000}
                step={1}
                defaultValue={String(defaultGold.sheep)}
                disabled={settingsDisabled}
                isAuto={lobbySettings.startingGold.sheep === defaultGold.sheep}
                onResetToAuto={() =>
                  send({
                    type: "lobbySettings",
                    startingGold: {
                      ...lobbySettings.startingGold,
                      sheep: defaultGold.sheep,
                    },
                  })}
                onChange={(value) =>
                  send({
                    type: "lobbySettings",
                    startingGold: {
                      ...lobbySettings.startingGold,
                      sheep: value,
                    },
                  })}
              />
              <NumericSettingInput
                id="wolves-gold"
                label={t("lobby.startingGoldWolf")}
                value={lobbySettings.startingGold.wolves}
                min={0}
                max={100000}
                step={1}
                defaultValue={String(defaultGold.wolves)}
                disabled={settingsDisabled}
                isAuto={lobbySettings.startingGold.wolves ===
                  defaultGold.wolves}
                onResetToAuto={() =>
                  send({
                    type: "lobbySettings",
                    startingGold: {
                      ...lobbySettings.startingGold,
                      wolves: defaultGold.wolves,
                    },
                  })}
                onChange={(value) =>
                  send({
                    type: "lobbySettings",
                    startingGold: {
                      ...lobbySettings.startingGold,
                      wolves: value,
                    },
                  })}
              />
            </HostRow2>

            <HostRow2>
              <ClearablePercentField
                id="sheep-income"
                label={t("lobby.incomeRateSheep")}
                value={lobbySettings.income.sheep}
                defaultValue={defaultIncome.sheep}
                min={0}
                max={100}
                disabled={settingsDisabled}
                onChange={(value) =>
                  send({
                    type: "lobbySettings",
                    income: { ...lobbySettings.income, sheep: value },
                  })}
                tooltip={t("lobby.incomeTooltipSheep")}
              />
              <ClearablePercentField
                id="wolves-income"
                label={t("lobby.incomeRateWolf")}
                value={lobbySettings.income.wolves}
                defaultValue={defaultIncome.wolves}
                min={0}
                max={100}
                disabled={settingsDisabled}
                onChange={(value) =>
                  send({
                    type: "lobbySettings",
                    income: { ...lobbySettings.income, wolves: value },
                  })}
                tooltip={t("lobby.incomeTooltipWolf")}
              />
            </HostRow2>
          </HostBody>
        )}
      </HostPanel>
    </Sidebar>
  );
};
