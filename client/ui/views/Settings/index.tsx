import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import {
  Gamepad2,
  Keyboard,
  Map,
  Monitor,
  SlidersHorizontal,
  Volume2,
  X,
} from "lucide-react";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { Dialog } from "@/components/layout/Dialog.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { type Preset, shortcutSettingsVar } from "@/vars/shortcutSettings.ts";
import { presetOverrides } from "@/vars/presets.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { bindingConflictsVar } from "@/hooks/useBindingConflicts.ts";
import { Presets } from "./Presets.tsx";
import { Gameplay } from "./Gameplay.tsx";
import { Shortcuts } from "./Shortcuts/Shortcuts.tsx";
import { Audio } from "./Audio.tsx";
import { Maps } from "./Maps.tsx";
import { UI } from "./UI.tsx";

const SettingsDialog = styled(Dialog)`
  width: min(960px, calc(100vw - 80px));
  height: min(720px, calc(100vh - 80px));
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.lg}, ${({ theme }) =>
    theme.shadow.inset};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
`;

const SettingsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: ${({ theme }) => theme.surface[0]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
`;

const Header = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
`;

const HeaderSub = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const PresetTag = styled.span`
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

const CloseButton = styled(Button)`
  padding: 0;
  width: 32px;
  min-height: 32px;
  background: transparent;
  border: 1px solid transparent;
  color: ${({ theme }) => theme.ink.mid};
  border-radius: ${({ theme }) => theme.radius.md};
  display: inline-grid;
  place-items: center;

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const TabIcon = styled.span<{ $active: boolean }>`
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  color: ${({ $active, theme }) => $active ? theme.accent.hi : theme.ink.lo};
`;

const SettingsBody = styled.div`
  display: grid;
  grid-template-columns: 180px 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const TabsContainer = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.surface[0]};
  border-right: 1px solid ${({ theme }) => theme.border.soft};
  overflow-y: auto;
`;

const Tab = styled(Button)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid ${({ $active, theme }) =>
    $active
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 35%, ${theme.border.DEFAULT})`
      : "transparent"};
  background: ${({ $active, theme }) =>
    $active ? theme.accent.bg : "transparent"};
  color: ${({ $active, theme }) => $active ? theme.accent.hi : theme.ink.mid};
  border-radius: ${({ theme }) => theme.radius.sm};
  width: 100%;
  text-align: left;
  outline: none;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;

  &.hover:not([disabled]) {
    color: ${({ theme }) => theme.ink.hi};
    background: ${({ $active, theme }) =>
      $active ? theme.accent.bg : theme.surface[2]};
  }
`;

const WarningDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.game.orange};
  flex-shrink: 0;
`;

const TabContent = styled.div`
  padding: ${({ theme }) => theme.space[6]};
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  min-width: 0;
`;

export const Settings = () => {
  const { t } = useTranslation();
  const showSettings = useReactiveVar(showSettingsVar);
  const { preset } = useReactiveVar(shortcutSettingsVar);
  const hasBindingConflicts = useReactiveVar(bindingConflictsVar);
  const [activeTab, setActiveTab] = useState<
    "presets" | "gameplay" | "shortcuts" | "audio" | "display" | "maps"
  >(
    "presets",
  );
  const setPreset = useCallback(
    (p: Preset) => {
      const overrides = presetOverrides[p];
      shortcutSettingsVar({
        ...shortcutSettingsVar(),
        preset: p,
        ...(overrides.useSlotBindings != null
          ? { useSlotBindings: overrides.useSlotBindings }
          : {}),
      });
      if (overrides.clearOrderOnRightClick != null) {
        gameplaySettingsVar({
          ...gameplaySettingsVar(),
          clearOrderOnRightClick: overrides.clearOrderOnRightClick,
        });
      }
    },
    [],
  );

  if (!showSettings) return null;

  const tabs = [
    {
      key: "presets" as const,
      label: t("settings.tabPresets"),
      icon: SlidersHorizontal,
    },
    {
      key: "gameplay" as const,
      label: t("settings.tabGameplay"),
      icon: Gamepad2,
    },
    {
      key: "shortcuts" as const,
      label: t("settings.tabShortcuts"),
      icon: Keyboard,
    },
    { key: "audio" as const, label: t("settings.tabAudio"), icon: Volume2 },
    { key: "display" as const, label: t("settings.tabDisplay"), icon: Monitor },
    { key: "maps" as const, label: t("settings.tabMaps"), icon: Map },
  ];

  return (
    <SettingsDialog>
      <SettingsHeader>
        <HeaderLeft>
          <Header>{t("settings.title")}</Header>
          <HeaderSub>
            {t("settings.presetLabel")}{" "}
            <PresetTag>{preset.toUpperCase()}</PresetTag>
          </HeaderSub>
        </HeaderLeft>
        <CloseButton
          type="button"
          onClick={() => showSettingsVar(false)}
          title={t("settings.close")}
        >
          <X size={14} strokeWidth={2} />
        </CloseButton>
      </SettingsHeader>
      <SettingsBody>
        <TabsContainer>
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              $active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon $active={activeTab === tab.key}>
                <tab.icon size={16} />
              </TabIcon>
              <span>{tab.label}</span>
              {tab.key === "shortcuts" && hasBindingConflicts && <WarningDot />}
            </Tab>
          ))}
        </TabsContainer>
        <TabContent>
          {activeTab === "presets" && (
            <Presets preset={preset} setPreset={setPreset} />
          )}
          {activeTab === "gameplay" && <Gameplay />}
          {activeTab === "shortcuts" && <Shortcuts />}
          {activeTab === "audio" && <Audio />}
          {activeTab === "display" && <UI />}
          {activeTab === "maps" && <Maps />}
        </TabContent>
      </SettingsBody>
    </SettingsDialog>
  );
};
