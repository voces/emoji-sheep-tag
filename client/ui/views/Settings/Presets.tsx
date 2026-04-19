import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { type Preset, presets } from "@/vars/shortcutSettings.ts";
import { SettingsPanelTitle } from "./commonStyles.tsx";

const PresetDesc = styled.p`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
  margin: 0 0 ${({ theme }) => theme.space[4]};
  line-height: 1.55;
  max-width: 560px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
`;

const PresetCard = styled.button<{ $active: boolean }>`
  background: ${({ $active, theme }) =>
    $active
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 8%, ${theme.surface[2]})`
      : theme.surface[2]};
  border: 1px solid ${({ $active, theme }) =>
    $active ? theme.accent.DEFAULT : theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space[4]};
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  ${({ $active, theme }) =>
    $active ? `box-shadow: 0 0 0 3px ${theme.accent.bg};` : ""} &.hover {
    border-color: ${({ theme }) => theme.border.hi};
    background: ${({ theme }) => theme.surface[3]};
  }
`;

const PresetCardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.space[1]};
`;

const PresetCardLabel = styled.span`
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: 700;
  letter-spacing: -0.01em;
`;

const PresetCardSub = styled.div`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
`;

const ActiveTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.accent.hi};
  background: ${({ theme }) => theme.accent.bg};
  border: 1px solid
    color-mix(
      in oklab,
      ${({ theme }) => theme.accent.DEFAULT} 35%,
      ${({ theme }) => theme.border.DEFAULT}
    );
  line-height: 1.6;
`;

const DiffHeading = styled.h4`
  margin: ${({ theme }) => theme.space[6]} 0 ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.mid};
`;

const DiffList = styled.div`
  background: ${({ theme }) => theme.surface[0]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const DiffRow = styled.div`
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: ${({ theme }) => theme.space[4]};
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  font-size: ${({ theme }) => theme.text.sm};

  &:last-child {
    border-bottom: none;
  }
`;

const DiffKey = styled.div`
  color: ${({ theme }) => theme.ink.lo};
`;

const DiffValue = styled.div`
  color: ${({ theme }) => theme.ink.hi};
  overflow-wrap: anywhere;
`;

const PRESET_SUB_KEYS: Record<Preset, string> = {
  est: "settings.presetEstSub",
  wc3: "settings.presetWc3Sub",
};

const PRESET_DIFF_KEYS: Record<Preset, [string, string][]> = {
  est: [
    ["settings.presetClearOrderKey", "settings.presetEstClearOrder"],
    ["settings.presetSlotBindingsKey", "settings.presetEstSlotBindings"],
    ["settings.presetBuildMenuKey", "settings.presetEstBuildMenu"],
    ["settings.presetHotkeyRemapsKey", "settings.presetEstHotkeyRemaps"],
  ],
  wc3: [
    ["settings.presetClearOrderKey", "settings.presetWc3ClearOrder"],
    ["settings.presetSlotBindingsKey", "settings.presetWc3SlotBindings"],
    ["settings.presetBuildMenuKey", "settings.presetWc3BuildMenu"],
    ["settings.presetHotkeyRemapsKey", "settings.presetWc3HotkeyRemaps"],
  ],
};

export const Presets = (
  { preset, setPreset }: { preset: Preset; setPreset: (p: Preset) => void },
) => {
  const { t } = useTranslation();
  const diffKeys = PRESET_DIFF_KEYS[preset];

  return (
    <div>
      <SettingsPanelTitle>{t("settings.presetsTitle")}</SettingsPanelTitle>
      <PresetDesc>{t("settings.presetsDesc")}</PresetDesc>

      <PresetGrid>
        {presets.map((p) => (
          <PresetCard
            key={p}
            $active={preset === p}
            onClick={() => setPreset(p)}
          >
            <PresetCardHead>
              <PresetCardLabel>{p.toUpperCase()}</PresetCardLabel>
              {preset === p && (
                <ActiveTag>{t("settings.presetsActive")}</ActiveTag>
              )}
            </PresetCardHead>
            <PresetCardSub>{t(PRESET_SUB_KEYS[p])}</PresetCardSub>
          </PresetCard>
        ))}
      </PresetGrid>

      <DiffHeading>{t("settings.presetChanges")}</DiffHeading>
      <DiffList>
        {diffKeys.map(([keyI18n, valueI18n]) => (
          <DiffRow key={keyI18n}>
            <DiffKey>{t(keyI18n)}</DiffKey>
            <DiffValue>{t(valueI18n)}</DiffValue>
          </DiffRow>
        ))}
      </DiffList>
    </div>
  );
};
