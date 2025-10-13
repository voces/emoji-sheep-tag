import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback } from "react";
import { type AudioSettings, audioSettingsVar } from "@/vars/audioSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";

export const Audio = () => {
  const audioSettings = useReactiveVar(audioSettingsVar) as AudioSettings;

  const handleMasterChange = useCallback((value: number) => {
    audioSettingsVar({ ...audioSettingsVar(), master: value });
  }, []);

  const handleSfxChange = useCallback((value: number) => {
    audioSettingsVar({ ...audioSettingsVar(), sfx: value });
  }, []);

  const handleUiChange = useCallback((value: number) => {
    audioSettingsVar({ ...audioSettingsVar(), ui: value });
  }, []);

  const handleAmbienceChange = useCallback((value: number) => {
    audioSettingsVar({ ...audioSettingsVar(), ambience: value });
  }, []);

  const formatPercent = useCallback(
    (value: number) => `${Math.round(value * 100)}%`,
    [],
  );

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>Volume Settings</SettingsPanelTitle>
      <Slider
        label="Master Volume"
        value={audioSettings.master}
        onChange={handleMasterChange}
        formatValue={formatPercent}
      />
      <Slider
        label="Sound Effects"
        value={audioSettings.sfx}
        onChange={handleSfxChange}
        formatValue={formatPercent}
      />
      <Slider
        label="User Interface"
        value={audioSettings.ui}
        onChange={handleUiChange}
        formatValue={formatPercent}
      />
      <Slider
        label="Ambience"
        value={audioSettings.ambience}
        onChange={handleAmbienceChange}
        formatValue={formatPercent}
      />
    </SettingsPanelContainer>
  );
};
