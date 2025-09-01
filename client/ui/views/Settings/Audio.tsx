import { useReactiveVar } from "@/hooks/useVar.tsx";
//@deno-types="npm:@types/react"
import { useCallback } from "react";
import { styled } from "npm:styled-components";
import { type AudioSettings, audioSettingsVar } from "@/vars/audioSettings.ts";
import { VStack } from "@/components/layout/Layout.tsx";
import { Slider } from "@/components/forms/Slider.tsx";

const AudioContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.lg};
  max-height: 100%;
  padding-right: ${({ theme }) => theme.spacing.lg};
`;

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

  return (
    <AudioContainer>
      <h3>Volume Settings</h3>
      <Slider
        label="Master Volume"
        value={audioSettings.master}
        onChange={handleMasterChange}
      />
      <Slider
        label="Sound Effects"
        value={audioSettings.sfx}
        onChange={handleSfxChange}
      />
      <Slider
        label="User Interface"
        value={audioSettings.ui}
        onChange={handleUiChange}
      />
      <Slider
        label="Ambience"
        value={audioSettings.ambience}
        onChange={handleAmbienceChange}
      />
    </AudioContainer>
  );
};
