import { useState } from "react";
import { styled } from "styled-components";
import { keyboard } from "../../../controls.ts";
import { prefabs } from "@/shared/data.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import Collapse from "@/components/layout/Collapse.tsx";
import {
  type ConflictInfo,
  defaultBindings,
  detectMenuConflicts,
  getActionDisplayName,
  isDefaultBinding,
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

const ConflictWarning = styled.div`
  color: ${({ theme }) => theme.colors.orange};
  font-size: 0.85em;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(255, 165, 0, 0.1);
  border-radius: 2px;
`;

interface ShortcutRowProps {
  actionKey: string;
  shortcut: string[];
  fullKey: string;
  isNested?: boolean;
  section: string;
  onSetBinding: (key: string, binding: string[]) => void;
  conflict?: ConflictInfo;
}

const ShortcutRow = ({
  actionKey,
  shortcut,
  fullKey,
  isNested = false,
  section,
  onSetBinding,
  conflict,
}: ShortcutRowProps) => {
  const isDefault = isDefaultBinding(
    section,
    fullKey,
    shortcut,
    defaultBindings,
  );

  return (
    <VStack style={{ gap: "4px" }}>
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
            disabled={isDefault}
          >
            ↺
          </Button>
        </ShortcutInputContainer>
      </ShortcutRowContainer>
      {conflict && (
        <ConflictWarning>
          ⚠ Conflicts with:{" "}
          {conflict.conflictsWith.map((c) =>
            getActionDisplayName(c.actionKey, section)
          ).join(", ")}
        </ConflictWarning>
      )}
    </VStack>
  );
};

interface SettingsSectionProps {
  section: string;
  shortcuts: Record<string, string[]>;
  setBinding: (shortcut: string, binding: string[]) => void;
  defaultOpen?: boolean;
}

export const SettingsSection = (
  { section, shortcuts, setBinding, defaultOpen = false }: SettingsSectionProps,
) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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

  // Detect conflicts within top-level shortcuts and within each menu separately
  // Skip conflict detection for misc section
  const topLevelConflicts = section === "misc"
    ? new Map<string, ConflictInfo>()
    : detectMenuConflicts(topLevelShortcuts);

  const menuConflicts: Record<string, Map<string, ConflictInfo>> = {};
  if (section !== "misc") {
    for (const [menuName, menuBindings] of Object.entries(menuShortcuts)) {
      menuConflicts[menuName] = detectMenuConflicts(menuBindings);
    }
  }

  // Check if there are any conflicts (top-level or menu-level)
  const hasConflicts = topLevelConflicts.size > 0 ||
    Object.values(menuConflicts).some((menuConflict) => menuConflict.size > 0);

  // Check if there are any non-default bindings (overrides)
  const hasOverrides = Object.entries(shortcuts).some(([key, binding]) =>
    !isDefaultBinding(section, key, binding, defaultBindings)
  );

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
          conflict={topLevelConflicts.get(key)}
        />,
      );

      // If this is a menu action, add its subactions right after it
      if (menuShortcuts[key]) {
        const menuConflictsForKey = menuConflicts[key] ?? new Map();
        for (
          const [actionKey, menuShortcut] of Object.entries(menuShortcuts[key])
        ) {
          const menuFullKey = `${key}.${actionKey}`;
          result.push(
            <ShortcutRow
              key={menuFullKey}
              actionKey={actionKey}
              shortcut={menuShortcut}
              fullKey={menuFullKey}
              isNested
              section={section}
              onSetBinding={handleSetBinding}
              conflict={menuConflictsForKey.get(actionKey)}
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
        {hasOverrides && (
          <span style={{ marginLeft: "8px", opacity: 0.6 }}>*</span>
        )}
        {hasConflicts && <span style={{ marginLeft: "8px" }}>⚠</span>}
      </HoverHighlight>
      <Collapse isOpen={isOpen}>
        <VStack>
          {renderShortcuts()}
        </VStack>
      </Collapse>
    </VStack>
  );
};
