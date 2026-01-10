import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback, useState } from "react";
import { styled } from "styled-components";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";
import { flags } from "../../../flags.ts";

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SettingLabel = styled.label`
  font-size: 14px;
`;

export const UI = () => {
  const uiSettings = useReactiveVar(uiSettingsVar);
  const [debug, setDebug] = useState(flags.debug);

  const handlePreferredActionsPerRowChange = useCallback((value: number) => {
    uiSettingsVar({ ...uiSettingsVar(), preferredActionsPerRow: value });
  }, []);

  const formatPreferredActionsPerRow = useCallback((value: number) => {
    const modified = value !== 4 ? "* " : "";
    if (value === 0) return `${modified}None`;
    if (value === 11) return `${modified}Unlimited`;
    return `${modified}${value}`;
  }, []);

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>UI Settings</SettingsPanelTitle>
      <Slider
        label="Preferred actions per row"
        value={uiSettings.preferredActionsPerRow}
        onChange={handlePreferredActionsPerRowChange}
        formatValue={formatPreferredActionsPerRow}
        min={0}
        max={11}
        step={1}
      />

      <SettingRow>
        <Checkbox
          id="show-ping"
          checked={uiSettings.showPing}
          onChange={(e) =>
            uiSettingsVar({
              ...uiSettings,
              showPing: e.currentTarget.checked,
            })}
        />
        <SettingLabel htmlFor="show-ping">
          Show ping
        </SettingLabel>
      </SettingRow>

      <SettingRow>
        <Checkbox
          id="show-fps"
          checked={uiSettings.showFps}
          onChange={(e) =>
            uiSettingsVar({
              ...uiSettings,
              showFps: e.currentTarget.checked,
            })}
        />
        <SettingLabel htmlFor="show-fps">
          Show FPS
        </SettingLabel>
      </SettingRow>

      <SettingRow>
        <Checkbox
          id="enable-debugging"
          checked={debug}
          onChange={(e) => {
            const enabled = e.currentTarget.checked;
            flags.debug = enabled;
            setDebug(enabled);
            if (!enabled) {
              localStorage.removeItem("debug");
              globalThis.latency = 0;
              globalThis.noise = 0;
            } else {
              localStorage.setItem("debug", "true");
            }
          }}
        />
        <SettingLabel htmlFor="enable-debugging">
          Enable debugging
        </SettingLabel>
      </SettingRow>
    </SettingsPanelContainer>
  );
};
