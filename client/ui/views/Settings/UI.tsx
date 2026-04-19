import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { Slider } from "@/components/forms/Slider.tsx";
import { Toggle } from "@/components/forms/Toggle.tsx";
import {
  FieldGroup,
  SettingsPanelContainer,
  SettingsPanelTitle,
  ToggleGroup,
} from "./commonStyles.tsx";
import { flags } from "../../../flags.ts";

export const UI = () => {
  const { t } = useTranslation();
  const uiSettings = useReactiveVar(uiSettingsVar);
  const [debug, setDebug] = useState(flags.debug);

  const handlePreferredActionsPerRowChange = useCallback((value: number) => {
    uiSettingsVar({ ...uiSettingsVar(), preferredActionsPerRow: value });
  }, []);

  const formatPreferredActionsPerRow = useCallback((value: number) => {
    const modified = value !== 4 ? "* " : "";
    if (value === 0) return `${modified}${t("settings.preferredActionsNone")}`;
    return `${modified}${value}`;
  }, [t]);

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>{t("settings.uiTitle")}</SettingsPanelTitle>
      <FieldGroup>
        <Slider
          label={t("settings.preferredActionsPerRow")}
          value={uiSettings.preferredActionsPerRow}
          onChange={handlePreferredActionsPerRowChange}
          formatValue={formatPreferredActionsPerRow}
          min={0}
          max={8}
          step={1}
        />
      </FieldGroup>

      <ToggleGroup>
        <Toggle
          checked={uiSettings.showPing}
          onChange={(checked) =>
            uiSettingsVar({ ...uiSettings, showPing: checked })}
        >
          {t("settings.showPing")}
        </Toggle>

        <Toggle
          checked={uiSettings.showFps}
          onChange={(checked) =>
            uiSettingsVar({ ...uiSettings, showFps: checked })}
        >
          {t("settings.showFps")}
        </Toggle>

        <Toggle
          checked={debug}
          onChange={(checked) => {
            flags.debug = checked;
            setDebug(checked);
            if (!checked) {
              localStorage.removeItem("debug");
              globalThis.latency = 0;
              globalThis.noise = 0;
            } else {
              localStorage.setItem("debug", "true");
            }
          }}
        >
          {t("settings.enableDebugging")}
        </Toggle>
      </ToggleGroup>
    </SettingsPanelContainer>
  );
};
