//@deno-types="npm:@types/react"
import { useState } from "react";
import { styled } from "npm:styled-components";
import { keyboard } from "../../../controls.ts";
import { prefabs } from "@/shared/data.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import Collapse from "@/components/layout/Collapse.tsx";
import {
  defaultBindings,
  getActionDisplayName,
  type Shortcuts,
} from "@/util/shortcutUtils.ts";
import { HoverHighlight, HStack, VStack } from "@/components/layout/Layout.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { Button } from "@/components/forms/Button.tsx";

const ShortcutRowContainer = styled(HStack)<{ $isNested?: boolean }>`
  padding-left: ${({ $isNested }) => $isNested ? "16px" : "0"};
`;

const ShortcutLabel = styled.p`
  flex: 1;
  flex-basis: 1;
`;

const ShortcutInputContainer = styled(HStack)`
  align-items: center;
`;

const ShortcutInput = styled(Input)`
  width: 100%;
  max-width: 150px;
`;

const SectionHeader = styled.h3`
  cursor: pointer;
`;

const HeaderIcon = styled.span`
  display: inline-block;
  width: 2ch;
`;

interface ShortcutRowProps {
  actionKey: string;
  shortcut: string[];
  fullKey: string;
  isNested?: boolean;
  section: string;
  onSetBinding: (key: string, binding: string[]) => void;
}

const ShortcutRow = ({
  actionKey,
  shortcut,
  fullKey,
  isNested = false,
  section,
  onSetBinding,
}: ShortcutRowProps) => (
  <ShortcutRowContainer $isNested={isNested}>
    <ShortcutLabel>
      {getActionDisplayName(actionKey, section)}
    </ShortcutLabel>
    <ShortcutInputContainer>
      <ShortcutInput
        value={formatShortcut(shortcut)}
        onChange={() => {}}
        onKeyDown={(e) => {
          onSetBinding(
            fullKey,
            Array.from(new Set([...Object.keys(keyboard), e.code])),
          );
          e.preventDefault();
        }}
      />
      <Button
        type="button"
        onClick={() =>
          onSetBinding(fullKey, defaultBindings[section]?.[fullKey] ?? [])}
        aria-label="Reset hotkey"
      >
        ↺
      </Button>
    </ShortcutInputContainer>
  </ShortcutRowContainer>
);

interface SettingsSectionProps {
  section: string;
  shortcuts: Record<string, string[]>;
  setBinding: (shortcut: string, binding: string[]) => Shortcuts;
}

export const SettingsSection = (
  { section, shortcuts, setBinding }: SettingsSectionProps,
) => {
  const [isOpen, setIsOpen] = useState(false);

  // Group shortcuts by menu context (nested vs top-level)
  const topLevelShortcuts: Record<string, string[]> = {};
  const menuShortcuts: Record<string, Record<string, string[]>> = {};

  for (const [key, binding] of Object.entries(shortcuts)) {
    if (key.includes(".")) {
      // This is a menu shortcut (e.g., "shop.back" or "shop.purchase-claw")
      const [menuName, actionKey] = key.split(".", 2);
      if (!menuShortcuts[menuName]) {
        menuShortcuts[menuName] = {};
      }
      menuShortcuts[menuName][actionKey] = binding;
    } else {
      // This is a top-level shortcut
      topLevelShortcuts[key] = binding;
    }
  }

  const handleSetBinding = (key: string, binding: string[]) => {
    setBinding(key, binding);
  };

  // Render actions in order: top-level first, then menu actions with their subactions
  const renderShortcuts = () => {
    const result = [];

    // Add top-level shortcuts first
    for (const [key, shortcut] of Object.entries(topLevelShortcuts)) {
      result.push(
        <ShortcutRow
          key={key}
          actionKey={key}
          shortcut={shortcut}
          fullKey={key}
          isNested={false}
          section={section}
          onSetBinding={handleSetBinding}
        />,
      );

      // If this is a menu action, add its subactions right after it
      if (menuShortcuts[key]) {
        for (
          const [actionKey, menuShortcut] of Object.entries(menuShortcuts[key])
        ) {
          result.push(
            <ShortcutRow
              key={`${key}.${actionKey}`}
              actionKey={actionKey}
              shortcut={menuShortcut}
              fullKey={`${key}.${actionKey}`}
              isNested
              section={section}
              onSetBinding={handleSetBinding}
            />,
          );
        }
      }
    }

    return result;
  };

  return (
    <VStack>
      <HoverHighlight as={SectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <HeaderIcon>
          {isOpen ? "▼" : "▶"}
        </HeaderIcon>
        {section === "misc" ? "Misc" : prefabs[section].name ?? section}
      </HoverHighlight>
      <Collapse isOpen={isOpen}>
        <VStack>
          {renderShortcuts()}
        </VStack>
      </Collapse>
    </VStack>
  );
};
