import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useTranslation } from "react-i18next";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { Toggle } from "@/components/forms/Toggle.tsx";
import { InfoTooltip } from "@/components/InfoTooltip.tsx";
import {
  FieldGroup,
  SettingDivider,
  SettingSectionTitle,
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

      <SettingSectionTitle>{t("settings.cameraSection")}</SettingSectionTitle>
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
        <Slider
          label={t("settings.panSpeed")}
          value={settings.panSpeed}
          min={0.2}
          max={3}
          step={0.1}
          formatValue={(v) => `${v}x`}
          onChange={(value) =>
            gameplaySettingsVar({ ...settings, panSpeed: value })}
        />
      </FieldGroup>

      <SettingDivider />

      <SettingSectionTitle>{t("settings.inputSection")}</SettingSectionTitle>
      <ToggleGroup>
        <Toggle
          checked={settings.pointerLock === "always"}
          onChange={(checked) =>
            gameplaySettingsVar({
              ...settings,
              pointerLock: checked ? "always" : "never",
            })}
        >
          {t("settings.pointerLock")}{" "}
          <InfoTooltip text={t("settings.pointerLockTooltip")} />
        </Toggle>

        <Toggle
          checked={settings.rawMouseInput}
          onChange={(checked) =>
            gameplaySettingsVar({
              ...settings,
              rawMouseInput: checked,
            })}
          disabled={settings.pointerLock === "never"}
        >
          {t("settings.rawMouseInput")}{" "}
          <InfoTooltip text={t("settings.rawMouseInputTooltip")} />
        </Toggle>
        <Slider
          label={t("settings.mouseSensitivity")}
          value={settings.mouseSensitivity}
          min={0.2}
          max={3}
          step={0.1}
          formatValue={(v) => `${v}x`}
          disabled={settings.pointerLock === "never"}
          onChange={(value) =>
            gameplaySettingsVar({ ...settings, mouseSensitivity: value })}
        />
      </ToggleGroup>

      <SettingDivider />

      <SettingSectionTitle>
        {t("settings.interfaceSection")}
      </SettingSectionTitle>
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
