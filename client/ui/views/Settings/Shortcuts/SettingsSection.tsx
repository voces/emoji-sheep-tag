import { useState } from "react";
import { styled } from "styled-components";
import { prefabs } from "@/shared/data.ts";
import Collapse from "@/components/layout/Collapse.tsx";
import { isDefaultBinding } from "@/util/shortcutUtils.ts";
import { HoverHighlight, HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { isDefaultMenu, menusVar } from "@/vars/menus.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { MenuDisplay } from "./MenuDisplay.tsx";
import { useMenuManagement } from "./useMenuManagement.ts";
import { useShortcutGroups } from "./useShortcutGroups.ts";
import { findMenuForAction } from "./menuActionHelpers.ts";
import { defaultBindings } from "@/util/shortcutUtils.ts";

const SectionHeader = styled.h3`
  cursor: pointer;
`;

const HeaderIcon = styled.span`
  display: inline-block;
  width: 2ch;
`;

type SettingsSectionProps = {
  section: string;
  shortcuts: Record<string, string[]>;
  setBinding: (shortcut: string, binding: string[]) => void;
  defaultOpen?: boolean;
};

export const SettingsSection = ({
  section,
  shortcuts,
  setBinding,
  defaultOpen = false,
}: SettingsSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const menus = useReactiveVar(menusVar);

  // Get menus for this section
  const sectionMenus = menus.filter((menu) => menu.prefabs.includes(section));

  // Menu management
  const menuManagement = useMenuManagement(menus, section);

  // Organize shortcuts and detect conflicts
  const {
    topLevelShortcuts,
    menuShortcuts,
    topLevelConflicts,
    menuConflicts,
    hasConflicts,
  } = useShortcutGroups(shortcuts, sectionMenus, section);

  // Check if there are any non-default bindings or menu configurations (overrides)
  const hasBindingOverrides = Object.entries(shortcuts).some(([key, binding]) =>
    !isDefaultBinding(section, key, binding, defaultBindings)
  );
  const hasNonDefaultMenus = sectionMenus.some((menu) => !isDefaultMenu(menu));
  const hasDeletedDefaultMenus =
    menuManagement.restoration.getDeleted().length > 0;
  const hasOverrides = hasBindingOverrides || hasNonDefaultMenus ||
    hasDeletedDefaultMenus;

  const handleSetBinding = (key: string, binding: string[]) => {
    setBinding(key, binding);
  };

  const renderTopLevelShortcuts = () =>
    Object.entries(topLevelShortcuts).map(([key, shortcut]) => (
      <ShortcutRow
        key={key}
        actionKey={key}
        shortcut={shortcut}
        fullKey={key}
        isNested={false}
        section={section}
        onSetBinding={handleSetBinding}
        conflict={topLevelConflicts.get(key)}
        editingMenuId={menuManagement.editing.form?.id ?? null}
        isInMenu={findMenuForAction(key, sectionMenus)}
        onAddToMenu={(actionKey) =>
          menuManagement.editing.form?.id &&
          menuManagement.actions.add(
            menuManagement.editing.form.id,
            actionKey,
          )}
        onRemoveFromMenu={(actionKey) =>
          menuManagement.editing.form?.id &&
          menuManagement.actions.remove(
            menuManagement.editing.form.id,
            actionKey,
          )}
      />
    ));

  const renderConfiguredMenus = () =>
    sectionMenus.map((menu) => {
      const menuKey = `menu-${menu.id}`;
      const menuConflictsForKey = menuConflicts[menuKey] ?? new Map();
      const menuBindingConflict = topLevelConflicts.get(menuKey);

      return (
        <MenuDisplay
          key={menuKey}
          menu={menu}
          section={section}
          shortcuts={shortcuts}
          menuConflicts={menuConflictsForKey}
          menuBindingConflict={menuBindingConflict}
          menuManagement={menuManagement}
          onSetBinding={handleSetBinding}
        />
      );
    });

  const renderLegacyMenuShortcuts = () => {
    const result = [];
    for (const [menuKey, menuBindings] of Object.entries(menuShortcuts)) {
      const menuConflictsForKey = menuConflicts[menuKey] ?? new Map();
      for (const [actionKey, menuShortcut] of Object.entries(menuBindings)) {
        const menuFullKey = `${menuKey}.${actionKey}`;
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
            editingMenuId={menuManagement.editing.form?.id ?? null}
            isInMenu={menuKey.startsWith("menu-")
              ? menuKey.replace("menu-", "")
              : null}
            onAddToMenu={(actionKey) =>
              menuManagement.editing.form?.id &&
              menuManagement.actions.add(
                menuManagement.editing.form.id,
                actionKey,
              )}
            onRemoveFromMenu={(actionKey) =>
              menuManagement.editing.form?.id &&
              menuManagement.actions.remove(
                menuManagement.editing.form.id,
                actionKey,
              )}
          />,
        );
      }
    }
    return result;
  };

  const header = section === "misc" ? "Misc" : prefabs[section].name ?? section;

  return (
    <VStack data-testid={`section-${header}`}>
      <HoverHighlight as={SectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <HeaderIcon>
          {isOpen ? "▼" : "▶"}
        </HeaderIcon>
        {header}
        {hasOverrides && (
          <span style={{ marginLeft: "8px", opacity: 0.6 }}>*</span>
        )}
        {hasConflicts && <span style={{ marginLeft: "8px" }}>⚠</span>}
      </HoverHighlight>
      <Collapse isOpen={isOpen}>
        <VStack>
          {renderTopLevelShortcuts()}
          {renderConfiguredMenus()}
          {renderLegacyMenuShortcuts()}
          {section !== "misc" && (
            <HStack>
              <Button
                type="button"
                onClick={menuManagement.creation.createMenu}
                style={{ marginTop: "8px", alignSelf: "flex-start" }}
              >
                + Create Menu
              </Button>
              {menuManagement.creation.hasTopLevelBuildActions() && (
                <Button
                  type="button"
                  onClick={menuManagement.creation.createBuildMenu}
                  style={{ marginTop: "8px", alignSelf: "flex-start" }}
                >
                  + Create Build Menu
                </Button>
              )}
              {menuManagement.restoration.getDeleted().map((menu) => (
                <Button
                  key={menu.id}
                  type="button"
                  onClick={() => menuManagement.restoration.restore(menu.id)}
                  style={{ marginTop: "8px", alignSelf: "flex-start" }}
                >
                  ↻ Restore {menu.name}
                </Button>
              ))}
            </HStack>
          )}
        </VStack>
      </Collapse>
    </VStack>
  );
};
