//@deno-types="npm:@types/react"
import { useState } from "react";
import { keyboard } from "../../controls.ts";
import { prefabs } from "../../../shared/data.ts";
import { formatShortcut } from "../util/formatShortcut.ts";
import Collapse from "./Collapse.tsx";
import {
  defaultBindings,
  getActionDisplayName,
  type Shortcuts,
} from "../util/shortcutUtils.ts";

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
  <div
    className="h-stack"
    style={{ paddingLeft: isNested ? 16 : 0 }}
  >
    <p style={{ flex: 1, flexBasis: 1 }}>
      {getActionDisplayName(actionKey, section)}
    </p>
    <div
      className="h-stack"
      style={{ flex: 1, flexBasis: 1, justifyContent: "end" }}
    >
      <input
        value={formatShortcut(shortcut)}
        style={{ width: "100%", maxWidth: 150 }}
        onChange={() => {}}
        onKeyDown={(e) => {
          onSetBinding(
            fullKey,
            Array.from(new Set([...Object.keys(keyboard), e.code])),
          );
          e.preventDefault();
        }}
      />
      <button
        type="button"
        onClick={() => onSetBinding(fullKey, defaultBindings[section][fullKey])}
      >
        ↺
      </button>
    </div>
  </div>
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
    <div className="v-stack">
      <h2 onClick={() => setIsOpen(!isOpen)} className="hover-highlight">
        <span style={{ display: "inline-block", width: "2ch" }}>
          {isOpen ? "▼" : "▶"}
        </span>
        {section === "misc" ? "Misc" : prefabs[section].name ?? section}
      </h2>
      <Collapse className="v-stack" isOpen={isOpen}>
        {renderShortcuts()}
      </Collapse>
    </div>
  );
};
