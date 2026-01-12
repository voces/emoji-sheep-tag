import { memo, useCallback, useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { prefabs } from "@/shared/data.ts";
import Collapse from "@/components/layout/Collapse.tsx";
import { isDefaultBinding } from "@/util/shortcutUtils.ts";
import { HoverHighlight, HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { isDefaultMenu, type MenuConfig, menusVar } from "@/vars/menus.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { MenuDisplay } from "./MenuDisplay.tsx";
import { useMenuManagement } from "./useMenuManagement.ts";
import { useShortcutGroups } from "./useShortcutGroups.ts";
import { findMenuForAction } from "./menuActionHelpers.ts";
import { defaultBindings } from "@/util/shortcutUtils.ts";
import { registerDropTarget, useSectionDragState } from "./useDragState.ts";

const SectionHeader = styled.h3`
  cursor: pointer;
`;

const HeaderIcon = styled.span`
  display: inline-block;
  width: 2ch;
`;

const TopLevelDropZone = styled(VStack)`
`;

type SettingsSectionProps = {
  section: string;
  shortcuts: Record<string, string[]>;
  setBinding: (shortcut: string, binding: string[]) => void;
  defaultOpen?: boolean;
};

export const SettingsSection = memo(({
  section,
  shortcuts,
  setBinding,
  defaultOpen = false,
}: SettingsSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionMenus = useReactiveVar(
    menusVar,
    (menus) => menus.filter((menu) => menu.prefabs.includes(section)),
  );

  // Menu management
  const menuManagement = useMenuManagement(section);

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

  const handleSetBinding = useCallback(
    (key: string, binding: string[]) => setBinding(key, binding),
    [setBinding],
  );

  const { draggedAction } = useSectionDragState(section);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Register as drop target for removing from menus
  useEffect(() => {
    if (!dropZoneRef.current) return;
    return registerDropTarget(
      `section-${section}`,
      dropZoneRef.current,
      (data) => {
        if (data.section !== section) return;
        // If it came from a menu, remove it from that menu
        if (data.fromMenu) {
          menuManagement.actions.remove(data.fromMenu, data.actionKey);
        }
        // If it was already top-level (fromMenu is null), just cancel
      },
    );
  }, [section, menuManagement.actions]);

  const renderTopLevelItems = () => {
    // Combine shortcuts and menus into a sortable list
    type TopLevelItem =
      | { type: "shortcut"; key: string; shortcut: string[] }
      | { type: "menu"; menu: MenuConfig };

    const items: TopLevelItem[] = [
      ...Object.entries(topLevelShortcuts).map(
        ([key, shortcut]): TopLevelItem => ({
          type: "shortcut",
          key,
          shortcut,
        }),
      ),
      ...sectionMenus.map((menu): TopLevelItem => ({ type: "menu", menu })),
    ];

    // Sort by name alphabetically
    items.sort((a, b) => {
      const aName = a.type === "shortcut" ? a.key : a.menu.name;
      const bName = b.type === "shortcut" ? b.key : b.menu.name;
      return aName.localeCompare(bName);
    });

    return items.map((item) => {
      if (item.type === "shortcut") {
        const { key, shortcut } = item;
        return (
          <ShortcutRow
            key={key}
            actionKey={key}
            shortcut={shortcut}
            fullKey={key}
            isNested={false}
            section={section}
            onSetBinding={handleSetBinding}
            conflict={topLevelConflicts.get(key)}
            isInMenu={findMenuForAction(key, sectionMenus)}
            draggable
            draggedActionKey={draggedAction}
          />
        );
      } else {
        const { menu } = item;
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
            draggedActionKey={draggedAction}
          />
        );
      }
    });
  };

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
            isInMenu={menuKey.startsWith("menu-")
              ? menuKey.replace("menu-", "")
              : null}
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
        <TopLevelDropZone ref={dropZoneRef}>
          {renderTopLevelItems()}
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
              {!menuManagement.creation.hasNestedBuildActions() && (
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
        </TopLevelDropZone>
      </Collapse>
    </VStack>
  );
});

SettingsSection.displayName = "SettingsSection";
