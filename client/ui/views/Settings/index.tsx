import { useReactiveVar } from "@/hooks/useVar.tsx";
//@deno-types="npm:@types/react"
import { useState } from "react";
import { styled } from "styled-components";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { HStack, Overlay, VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Shortcuts } from "./Shortcuts.tsx";
import { Audio } from "./Audio.tsx";

const SettingsDialog = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  max-width: calc(100% - 16px);
  height: 80vh;
  max-height: 800px;
  gap: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
  padding-right: 0;
  padding-left: 0;
`;

const SettingsContent = styled(HStack)`
  flex: 1;
  overflow: hidden;
  align-items: stretch;
  gap: 0;
`;

const TabsContainer = styled(VStack)`
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  padding-right: ${({ theme }) => theme.spacing.lg};
  margin-left: ${({ theme }) => theme.spacing.lg};
  min-width: 120px;
`;

const Tab = styled(Button)<{ $active: boolean }>`
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : "transparent"};
  color: ${({ theme }) => theme.colors.body};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) =>
    theme.spacing.lg};
  width: 100%;
  text-align: left;
  outline: none;

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.colors.primary};
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow: hidden;
  padding-left: ${({ theme }) => theme.spacing.lg};
`;

const SettingsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Header = styled.h1`
  margin-left: ${({ theme }) => theme.spacing.lg};
`;

const CloseButton = styled(Button)`
  padding: 0 ${({ theme }) => theme.spacing.md};
  margin-right: ${({ theme }) => theme.spacing.lg};
  font-weight: 800;
`;

export const Settings = () => {
  const showSettings = useReactiveVar(showSettingsVar);
  const [activeTab, setActiveTab] = useState<"shortcuts" | "audio">(
    "shortcuts",
  );

  if (!showSettings) return null;

  return (
    <Overlay>
      <SettingsDialog>
        <SettingsHeader>
          <Header>Settings</Header>
          <CloseButton
            type="button"
            onClick={() => showSettingsVar(false)}
            title="Close settings"
          >
            ✕
          </CloseButton>
        </SettingsHeader>
        <SettingsContent>
          <TabsContainer>
            <Tab
              $active={activeTab === "shortcuts"}
              onClick={() => setActiveTab("shortcuts")}
            >
              Shortcuts
            </Tab>
            <Tab
              $active={activeTab === "audio"}
              onClick={() => setActiveTab("audio")}
            >
              Audio
            </Tab>
          </TabsContainer>
          <TabContent>
            {activeTab === "shortcuts" && <Shortcuts />}
            {activeTab === "audio" && <Audio />}
          </TabContent>
        </SettingsContent>
      </SettingsDialog>
    </Overlay>
  );
};
