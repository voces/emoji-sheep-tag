import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { prefabs } from "@/shared/data.ts";
import Collapse from "@/components/layout/Collapse.tsx";
import {
  bindingsEqual,
  getBaseKey,
  getEffectiveDefault,
  getPresetAltDefaults,
  isAltKey,
  isDefaultBinding,
} from "@/util/shortcutUtils.ts";
import { SmallButton } from "@/components/forms/ActionButton.tsx";
import { isDefaultMenu, type MenuConfig, menusVar } from "@/vars/menus.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { MenuDisplay } from "./MenuDisplay.tsx";
import { useMenuManagement } from "./useMenuManagement.ts";
import { useShortcutGroups } from "./useShortcutGroups.ts";
import { findMenuForAction } from "./menuActionHelpers.ts";
import {
  defaultBindings,
  getControlGroupTooltip,
} from "@/util/shortcutUtils.ts";
import { registerDropTarget, useSectionDragState } from "./useDragState.ts";

const SectionContainer = styled.div<{ $open: boolean }>`
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  background: ${({ $open, theme }) =>
    $open ? theme.surface[1] : theme.surface[0]};
`;

const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.md};
  text-align: left;
  cursor: pointer;

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const HeaderChev = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  display: inline-flex;
  align-items: center;
`;

const HeaderName = styled.span`
  font-weight: 600;
`;

const WarningTag = styled.span`
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.6;
  color: ${({ theme }) => theme.game.orange};
  background: ${({ theme }) => theme.danger.bg};
`;

const ModifiedPill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: none;
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.6;
  color: ${({ theme }) => theme.accent.hi};
  background: ${({ theme }) => theme.accent.bg};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    background: ${({ theme }) => theme.accent.lo};
    color: ${({ theme }) => theme.accent.ink};
  }
`;

const SectionBody = styled.div`
  padding: ${({ theme }) => theme.space[1]};
  border-top: 1px solid ${({ theme }) => theme.border.soft};
`;

const TopLevelDropZone = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SectionActions = styled.div`
  display: flex;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  gap: ${({ theme }) => theme.space[2]};
  flex-wrap: wrap;
`;

type SettingsSectionProps = {
  section: string;
  shortcuts: Record<string, string[]>;
  setBinding: (shortcut: string, binding: string[]) => void;
  defaultOpen?: boolean;
  useSlotBindings?: boolean;
  externalBindings?: Record<string, { binding: string[]; section: string }>;
  matchingKeys?: Set<string> | null;
  onReset?: () => void;
  onConflictsChange?: (section: string, hasConflicts: boolean) => void;
};

export const SettingsSection = memo(({
  section,
  shortcuts,
  setBinding,
  defaultOpen = false,
  useSlotBindings = false,
  externalBindings,
  matchingKeys,
  onReset,
  onConflictsChange,
}: SettingsSectionProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isFiltering = matchingKeys !== null && matchingKeys !== undefined;
  useEffect(() => {
    if (isFiltering) setIsOpen(true);
  }, [isFiltering]);
  const hasBeenOpened = useRef(defaultOpen);
  if (isOpen) hasBeenOpened.current = true;
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
  } = useShortcutGroups(
    shortcuts,
    sectionMenus,
    section,
    useSlotBindings,
    externalBindings,
  );

  // Check visible shortcuts for non-default bindings
  const visibleShortcuts = {
    ...topLevelShortcuts,
    ...Object.fromEntries(
      Object.entries(menuShortcuts).flatMap(([menuKey, bindings]) =>
        Object.entries(bindings).map(([k, v]) => [`${menuKey}.${k}`, v])
      ),
    ),
  };
  // Check for missing preset alt bindings (satisfied if any alt has the same value)
  const hasMissingPresetAlts = Object.keys(shortcuts).some((key) => {
    if (isAltKey(key)) return false;
    const presetAlts = getPresetAltDefaults(section, key);
    if (presetAlts.length === 0) return false;
    const altValues = Object.entries(shortcuts)
      .filter(([k]) => isAltKey(k) && getBaseKey(k) === key)
      .map(([, v]) => v);
    return presetAlts.some((pa) => {
      const existing = shortcuts[pa.key];
      return !(existing && bindingsEqual(existing, pa.binding)) &&
        !altValues.some((v) => bindingsEqual(v, pa.binding));
    });
  });
  // Check if user-added alts exist (binding doesn't match any preset alt on same base)
  const hasNonDefaultAlts = Object.entries(shortcuts).some(
    ([key, binding]) => {
      if (!isAltKey(key) || binding.length === 0) return false;
      return !isDefaultBinding(section, key, binding, defaultBindings);
    },
  );
  const hasBindingOverrides = hasMissingPresetAlts || hasNonDefaultAlts ||
    Object.entries(visibleShortcuts).some(
      ([key, binding]) =>
        !isDefaultBinding(section, key, binding, defaultBindings),
    );
  const hasCustomMenus = sectionMenus.some((menu) => !isDefaultMenu(menu));
  const hasDeletedDefaultMenus =
    menuManagement.restoration.getDeleted().length > 0;
  const hasOverrides = hasBindingOverrides || hasCustomMenus ||
    hasDeletedDefaultMenus;

  useEffect(() => {
    onConflictsChange?.(section, hasConflicts);
  }, [onConflictsChange, section, hasConflicts]);

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

  const altBindingsMap = Object.entries(shortcuts)
    .filter(([key, binding]) =>
      isAltKey(key) &&
      (binding.length > 0 || getEffectiveDefault(section, key).length === 0)
    )
    .reduce<Record<string, { key: string; binding: string[] }[]>>(
      (acc, [key, binding]) => {
        const base = getBaseKey(key);
        (acc[base] ??= []).push({ key, binding });
        return acc;
      },
      {},
    );

  const allAltKeysMap = Object.keys(shortcuts)
    .filter((key) => isAltKey(key))
    .reduce<Record<string, string[]>>((acc, key) => {
      const base = getBaseKey(key);
      (acc[base] ??= []).push(key);
      return acc;
    }, {});

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

    // Sort by name alphabetically (skip for controlGroups to preserve logical order)
    if (section !== "controlGroups") {
      items.sort((a, b) => {
        const aName = a.type === "shortcut" ? a.key : a.menu.name;
        const bName = b.type === "shortcut" ? b.key : b.menu.name;
        return aName.localeCompare(bName);
      });
    }

    const filtered = isFiltering
      ? items.filter((item) =>
        item.type === "shortcut" ? matchingKeys!.has(item.key) : true
      )
      : items;

    return filtered.map((item) => {
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
            draggable={sectionMenus.length > 0}
            draggedActionKey={draggedAction}
            altBindings={altBindingsMap[key]}
            allAltKeys={allAltKeysMap[key]}
            tooltip={getControlGroupTooltip(key)}
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
            matchingKeys={isFiltering ? matchingKeys : null}
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

  const header = section === "controlGroups"
    ? t("settings.selectionGroups")
    : section === "misc"
    ? t("settings.misc")
    : prefabs[section]?.name ?? section;

  return (
    <SectionContainer $open={isOpen} data-testid={`section-${header}`}>
      <SectionHeader onClick={() => setIsOpen(!isOpen)}>
        <HeaderChev>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </HeaderChev>
        <HeaderName>{header}</HeaderName>
        {hasOverrides && onReset && (
          <ModifiedPill
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            {t("settings.modified")}
            <RotateCcw size={10} />
          </ModifiedPill>
        )}
        {hasOverrides && !onReset && (
          <ModifiedPill as="span" style={{ cursor: "default" }}>
            {t("settings.modified")}
          </ModifiedPill>
        )}
        {hasConflicts && <WarningTag>{t("settings.conflicts")}</WarningTag>}
      </SectionHeader>
      <Collapse isOpen={isOpen}>
        {hasBeenOpened.current && (
          <SectionBody>
            <TopLevelDropZone ref={dropZoneRef}>
              {renderTopLevelItems()}
              {renderLegacyMenuShortcuts()}
              {section !== "misc" && section !== "controlGroups" && (
                <SectionActions>
                  <SmallButton
                    type="button"
                    onClick={menuManagement.creation.createMenu}
                  >
                    <Plus size={14} />
                    {t("settings.createMenu")}
                  </SmallButton>
                  {prefabs[section]?.actions?.some((a) => a.type === "build") &&
                    !menuManagement.creation.hasNestedBuildActions() &&
                    !menuManagement.restoration.getDeleted().some((m) =>
                      m.actions.some((a) =>
                        "type" in a && a.type === "action" &&
                        a.actionKey.startsWith("build-")
                      )
                    ) && (
                    <SmallButton
                      type="button"
                      onClick={menuManagement.creation.createBuildMenu}
                    >
                      <Plus size={14} />
                      {t("settings.createBuildMenu")}
                    </SmallButton>
                  )}
                  {menuManagement.restoration.getDeleted().map((menu) => (
                    <SmallButton
                      key={menu.id}
                      type="button"
                      onClick={() =>
                        menuManagement.restoration.restore(menu.id)}
                    >
                      <RotateCcw size={14} />
                      {t("settings.restoreMenu", { name: menu.name })}
                    </SmallButton>
                  ))}
                </SectionActions>
              )}
            </TopLevelDropZone>
          </SectionBody>
        )}
      </Collapse>
    </SectionContainer>
  );
});

SettingsSection.displayName = "SettingsSection";
