import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback } from "react";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";

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
    </SettingsPanelContainer>
  );
};
