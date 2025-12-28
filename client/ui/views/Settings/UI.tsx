import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback } from "react";
import { styled } from "styled-components";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";

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

  const handlePreferredActionsPerRowChange = useCallback((value: number) => {
    uiSettingsVar({ ...uiSettingsVar(), preferredActionsPerRow: value });
  }, []);

  const formatPreferredActionsPerRow = useCallback((value: number) => {
    if (value === 0) return "None";
    if (value === 11) return "Unlimited";
    return value.toString();
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
    </SettingsPanelContainer>
  );
};
