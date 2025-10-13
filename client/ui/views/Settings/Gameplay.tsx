import { useReactiveVar } from "@/hooks/useVar.tsx";
import { styled } from "styled-components";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { SettingsPanelContainer, SettingsPanelTitle } from "./commonStyles.tsx";
import { Slider } from "@/components/forms/Slider.tsx";
import { camera } from "../../../graphics/three.ts";

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SettingLabel = styled.label`
  font-size: 14px;
  cursor: pointer;
`;

export const Gameplay = () => {
  const settings = useReactiveVar(gameplaySettingsVar);

  return (
    <SettingsPanelContainer>
      <SettingsPanelTitle>Gameplay Settings</SettingsPanelTitle>
      <VStack>
        <SettingRow>
          <Checkbox
            id="clear-order-on-right-click"
            checked={settings.clearOrderOnRightClick}
            onChange={(e) =>
              gameplaySettingsVar({
                ...settings,
                clearOrderOnRightClick: e.currentTarget.checked,
              })}
          />
          <SettingLabel htmlFor="clear-order-on-right-click">
            Clear order on right click
          </SettingLabel>
        </SettingRow>
      </VStack>

      <Slider
        label="Sheep Zoom"
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
        label="Wolf Zoom"
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
        label="Spirit Zoom"
        value={settings.spiritZoom}
        min={5}
        max={20}
        step={0.1}
        onChange={(value) => {
          gameplaySettingsVar({ ...settings, spiritZoom: value });
          camera.position.z = value;
        }}
      />
    </SettingsPanelContainer>
  );
};
