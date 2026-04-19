import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useTranslation } from "react-i18next";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { Toggle } from "@/components/forms/Toggle.tsx";
import {
  FieldGroup,
  SettingDivider,
  SettingsPanelContainer,
  SettingsPanelTitle,
  ToggleGroup,
} from "./commonStyles.tsx";
import { Slider } from "@/components/forms/Slider.tsx";
import { camera } from "../../../graphics/three.ts";

export const Gameplay = () => {
  const { t } = useTranslation();
  const settings = useReactiveVar(gameplaySettingsVar);

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>{t("settings.gameplayTitle")}</SettingsPanelTitle>

      <FieldGroup>
        <Slider
          label={t("settings.sheepZoom")}
          value={settings.sheepZoom}
          min={5}
          max={20}
          step={0.1}
          onChange={(value) => {
            gameplaySettingsVar({ ...settings, sheepZoom: value });
            camera.position.z = value;
          }}
        />
        <Slider
          label={t("settings.wolfZoom")}
          value={settings.wolfZoom}
          min={5}
          max={20}
          step={0.1}
          onChange={(value) => {
            gameplaySettingsVar({ ...settings, wolfZoom: value });
            camera.position.z = value;
          }}
        />
        <Slider
          label={t("settings.spiritZoom")}
          value={settings.spiritZoom}
          min={5}
          max={20}
          step={0.1}
          onChange={(value) => {
            gameplaySettingsVar({ ...settings, spiritZoom: value });
            camera.position.z = value;
          }}
        />
      </FieldGroup>

      <SettingDivider />

      <ToggleGroup>
        <Toggle
          checked={settings.clearOrderOnRightClick}
          onChange={(checked) =>
            gameplaySettingsVar({
              ...settings,
              clearOrderOnRightClick: checked,
            })}
        >
          {t("settings.clearOrderOnRightClick")}
        </Toggle>

        <Toggle
          checked={settings.rawMouseInput}
          onChange={(checked) =>
            gameplaySettingsVar({
              ...settings,
              rawMouseInput: checked,
            })}
        >
          {t("settings.rawMouseInput")}
        </Toggle>

        <Toggle
          checked={settings.showHealthbars}
          onChange={(checked) =>
            gameplaySettingsVar({
              ...settings,
              showHealthbars: checked,
            })}
        >
          {t("settings.showHealthbars")}
        </Toggle>
      </ToggleGroup>
    </SettingsPanelContainer>
  );
};
