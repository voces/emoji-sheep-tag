import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type AudioSettings, audioSettingsVar } from "@/vars/audioSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import {
  FieldGroup,
  SettingsPanelContainer,
  SettingsPanelTitle,
} from "./commonStyles.tsx";

export const Audio = () => {
  const { t } = useTranslation();
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
      <SettingsPanelTitle>{t("settings.audioTitle")}</SettingsPanelTitle>
      <FieldGroup>
        <Slider
          label={t("settings.masterVolume")}
          value={audioSettings.master}
          onChange={handleMasterChange}
          formatValue={formatPercent}
        />
        <Slider
          label={t("settings.soundEffects")}
          value={audioSettings.sfx}
          onChange={handleSfxChange}
          formatValue={formatPercent}
        />
        <Slider
          label={t("settings.userInterface")}
          value={audioSettings.ui}
          onChange={handleUiChange}
          formatValue={formatPercent}
        />
        <Slider
          label={t("settings.ambience")}
          value={audioSettings.ambience}
          onChange={handleAmbienceChange}
          formatValue={formatPercent}
        />
      </FieldGroup>
    </SettingsPanelContainer>
  );
};
