import { useReactiveVar } from "@/hooks/useVar.tsx";
//@deno-types="npm:@types/react"
import { useEffect } from "react";
import { styled } from "npm:styled-components";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { SettingsSection } from "./SettingsSection.tsx";
import {
  type Shortcuts,
} from "@/util/shortcutUtils.ts";
import { VStack, HStack, Overlay } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";

const ShortcutsContainer = styled(VStack)`
  flex: 2.5;
  gap: ${({ theme }) => theme.spacing.lg};
  max-height: calc(100vh - 200px);
  overflow: auto;
`;

const SettingsDialog = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  max-width: calc(100% - 16px);
  gap: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
`;

const SettingsContent = styled(HStack)`
  align-items: flex-start;
`;

const ShortcutsLabel = styled(VStack)`
  flex: 1;
`;

const CloseButton = styled(Button)`
  margin-left: auto;
  padding: 0 ${({ theme }) => theme.spacing.xxl};
`;


const Shortcuts = () => {
  const sections = useReactiveVar(shortcutsVar);

  useEffect(() => {
    localStorage.setItem("shortcuts", JSON.stringify(sections));
  }, [sections]);

  return (
    <ShortcutsContainer>
      {Object.entries(sections).map(([section, shortcuts]) => (
        <SettingsSection
          key={section}
          section={section}
          shortcuts={shortcuts}
          setBinding={(shortcut, binding) =>
            shortcutsVar({
              ...sections,
              [section]: { ...shortcuts, [shortcut]: binding },
            })}
        />
      ))}
    </ShortcutsContainer>
  );
};

export const Settings = () => {
  const showSettings = useReactiveVar(showSettingsVar);

  if (!showSettings) return null;

  return (
    <Overlay>
      <SettingsDialog>
        <h1>Settings</h1>
        <SettingsContent>
          <ShortcutsLabel>
            <p>Shortcuts</p>
          </ShortcutsLabel>
          <Shortcuts />
        </SettingsContent>
        <CloseButton
          type="button"
          onClick={() => showSettingsVar(false)}
        >
          Close
        </CloseButton>
      </SettingsDialog>
    </Overlay>
  );
};
