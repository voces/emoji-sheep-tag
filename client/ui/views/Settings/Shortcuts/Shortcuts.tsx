import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { SettingsSection } from "./SettingsSection.tsx";
import { SettingsPanelContainer } from "../commonStyles.tsx";
import { Toggle } from "@/components/forms/Toggle.tsx";
import { shortcutSettingsVar } from "@/vars/shortcutSettings.ts";
import {
  defaultBindings,
  getActionDisplayName,
  getEffectiveDefault,
  isAltKey,
  isDefaultBinding,
} from "@/util/shortcutUtils.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import { styled } from "styled-components";
import { TextInput } from "@/components/forms/TextInput.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { SmallButton } from "@/components/forms/ActionButton.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { prefabs } from "@/shared/data.ts";
import { getActiveDefaultMenus, menusVar } from "@/vars/menus.ts";
import {
  DangerSmallButton,
  InlineConfirmBar,
} from "@/components/InlineConfirm.tsx";
import { bindingConflictsVar } from "@/hooks/useBindingConflicts.ts";

const filterNonDefaultBindings = (sections: typeof defaultBindings) => {
  const filtered: typeof defaultBindings = {};
  const allMenus = menusVar();

  for (const [section, shortcuts] of Object.entries(sections)) {
    const defaultSection = defaultBindings[section];
    if (!defaultSection) continue;

    const nonDefaultShortcuts: Record<string, string[]> = {};
    const sectionMenus = allMenus.filter((m) => m.prefabs.includes(section));

    for (const [key, binding] of Object.entries(shortcuts)) {
      // Alt bindings: persist if non-default
      if (isAltKey(key)) {
        if (!isDefaultBinding(section, key, binding, defaultBindings)) {
          nonDefaultShortcuts[key] = binding;
        }
        continue;
      }

      // Check if this is a menu binding key
      if (key.startsWith("menu-")) {
        const menuId = key.substring(5);
        const menu = sectionMenus.find((m) => m.id === menuId);
        if (menu) {
          const defaultMenuBinding = menu.binding ?? [];
          const isDefault = binding.length === defaultMenuBinding.length &&
            binding.every((k, i) => k === defaultMenuBinding[i]);
          if (!isDefault) {
            nonDefaultShortcuts[key] = binding;
          }
        }
        continue;
      }

      // Only persist if binding differs from default
      if (!isDefaultBinding(section, key, binding, defaultBindings)) {
        nonDefaultShortcuts[key] = binding;
      }
    }

    // Only include sections that have non-default bindings
    if (Object.keys(nonDefaultShortcuts).length > 0) {
      filtered[section] = nonDefaultShortcuts;
    }
  }

  return filtered;
};

const findOtherUnitsWithSameBinding = (
  sections: typeof defaultBindings,
  currentSection: string,
  actionKey: string,
  currentBinding: string[],
): string[] => {
  const otherSections: string[] = [];

  for (const [section, shortcuts] of Object.entries(sections)) {
    if (
      section === currentSection || section === "misc" ||
      section === "controlGroups"
    ) continue;
    const otherBinding = shortcuts[actionKey];
    if (!otherBinding) continue;
    // Only include if the binding matches the current section's binding
    const matches = otherBinding.length === currentBinding.length &&
      otherBinding.every((k, i) => k === currentBinding[i]);
    if (matches) otherSections.push(section);
  }

  return otherSections;
};

const Modal = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled(VStack)`
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  padding: ${({ theme }) => theme.space[5]};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  max-width: 400px;
  gap: ${({ theme }) => theme.space[4]};
`;

const ModalButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  justify-content: flex-end;
`;

const ModalButton = styled(Button)`
  min-height: 28px;
  padding: 6px 14px;
  font-size: ${({ theme }) => theme.text.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};

  &.hover:not([disabled]) {
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const PrimaryButton = styled(ModalButton)`
  background: ${({ theme }) => theme.accent.DEFAULT};
  color: ${({ theme }) => theme.accent.ink};
  border-color: ${({ theme }) => theme.accent.DEFAULT};
  font-weight: 600;

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.accent.hi};
    border-color: ${({ theme }) => theme.accent.hi};
  }
`;

const UnitList = styled.ul`
  max-height: 200px;
  overflow-y: auto;
  padding-left: ${({ theme }) => theme.space[5]};
  color: ${({ theme }) => theme.ink.mid};
  font-size: ${({ theme }) => theme.text.md};
`;

const ToolbarTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
  white-space: nowrap;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
`;

const SearchWrapper = styled.div`
  position: relative;
  margin-left: auto;
  width: 220px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.ink.lo};
  display: flex;
  pointer-events: none;
`;

const SearchInput = styled(TextInput)`
  padding-left: 28px;
  min-height: 28px;

  &::placeholder {
    color: ${({ theme }) => theme.ink.mute};
  }
`;

const SectionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const EmptySearch = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.space[6]};
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.sm};
`;

const computeMatchingKeys = (
  section: string,
  shortcuts: Record<string, string[]>,
  query: string,
): Set<string> => {
  const q = query.toLowerCase();
  const matches = new Set<string>();
  for (const [key, binding] of Object.entries(shortcuts)) {
    if (isAltKey(key)) continue;
    const name = getActionDisplayName(key, section).toLowerCase();
    const keyStr = formatShortcut(binding).toLowerCase();
    if (name.includes(q) || keyStr.includes(q)) matches.add(key);
  }
  return matches;
};

type ConfirmDialogState = {
  section: string;
  actionKey: string;
  binding: string[];
  otherSections: string[];
} | null;

export const Shortcuts = () => {
  const { t } = useTranslation();
  const sections = useReactiveVar(shortcutsVar);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmingResetAll, setConfirmingResetAll] = useState(false);
  const sectionConflictsRef = useRef(new Map<string, boolean>());

  const handleConflictsChange = useCallback(
    (section: string, hasConflicts: boolean) => {
      sectionConflictsRef.current.set(section, hasConflicts);
      bindingConflictsVar(
        Array.from(sectionConflictsRef.current.values()).some(Boolean),
      );
    },
    [],
  );

  useEffect(() => {
    const filtered = filterNonDefaultBindings(sections);
    localStorage.setItem("shortcuts", JSON.stringify(filtered));
  }, [sections]);

  const handleSetBinding = (
    section: string,
    actionKey: string,
    binding: string[],
  ) => {
    if (isAltKey(actionKey)) {
      applySingleBinding(section, actionKey, binding);
      return;
    }

    const currentBinding = sections[section]?.[actionKey] ?? [];
    const otherSections = findOtherUnitsWithSameBinding(
      sections,
      section,
      actionKey,
      currentBinding,
    );

    if (otherSections.length > 0) {
      setConfirmDialog({ section, actionKey, binding, otherSections });
    } else {
      applySingleBinding(section, actionKey, binding);
    }
  };

  const applySingleBinding = (
    section: string,
    actionKey: string,
    binding: string[],
  ) => {
    if (
      isAltKey(actionKey) && binding.length === 0 &&
      actionKey in (sections[section] ?? {}) &&
      getEffectiveDefault(section, actionKey).length === 0
    ) {
      const { [actionKey]: _, ...rest } = sections[section];
      shortcutsVar({ ...sections, [section]: rest });
    } else {
      shortcutsVar({
        ...sections,
        [section]: { ...sections[section], [actionKey]: binding },
      });
    }
  };

  const applyToAll = () => {
    if (!confirmDialog) return;

    const { section, actionKey, binding, otherSections } = confirmDialog;
    const updatedSections = { ...sections };

    // Apply to current section
    updatedSections[section] = { ...sections[section], [actionKey]: binding };

    // Apply to all other sections
    for (const otherSection of otherSections) {
      updatedSections[otherSection] = {
        ...sections[otherSection],
        [actionKey]: binding,
      };
    }

    shortcutsVar(updatedSections);
    setConfirmDialog(null);
  };

  const applyToCurrentOnly = () => {
    if (!confirmDialog) return;

    const { section, actionKey, binding } = confirmDialog;
    applySingleBinding(section, actionKey, binding);
    setConfirmDialog(null);
  };

  const sectionEntries = Object.entries(sections);

  type ExternalBindings = Record<
    string,
    { binding: string[]; section: string }
  >;

  // Control group bindings (minus assignModifier) for cross-section conflict detection
  const controlGroupBindings: ExternalBindings = {};
  if (sections.controlGroups) {
    for (const [key, binding] of Object.entries(sections.controlGroups)) {
      if (key !== "assignModifier" && binding.length > 0) {
        controlGroupBindings[key] = { binding, section: "controlGroups" };
      }
    }
  }

  // All prefab bindings for controlGroups section conflict detection
  const allPrefabBindings: ExternalBindings = {};
  const allMenus = menusVar();
  for (const [section, shortcuts] of sectionEntries) {
    if (section === "misc" || section === "controlGroups") continue;
    for (const [key, binding] of Object.entries(shortcuts)) {
      if (binding.length > 0) allPrefabBindings[key] ??= { binding, section };
    }
    // Include menu bindings from menu configs (may not be in shortcuts)
    for (const menu of allMenus) {
      if (!menu.prefabs.includes(section)) continue;
      const menuKey = `menu-${menu.id}`;
      if (!allPrefabBindings[menuKey] && menu.binding?.length) {
        allPrefabBindings[menuKey] = { binding: menu.binding, section };
      }
    }
  }

  const handleResetAll = useCallback(() => {
    menusVar(getActiveDefaultMenus());
    const defaults = Object.fromEntries(
      Object.entries(defaultBindings).map(([section, bindings]) => [
        section,
        { ...bindings },
      ]),
    );
    shortcutsVar(defaults);
    localStorage.setItem("shortcuts", JSON.stringify({}));
  }, []);

  const handleResetSection = useCallback((section: string) => {
    // Reset menus first to prevent bindingOverrides from re-applying
    const activeDefaults = getActiveDefaultMenus();
    const defaultIds = new Set(activeDefaults.map((m) => m.id));
    const currentMenus = menusVar();
    const resetMenus = currentMenus.filter((m) =>
      !m.prefabs.includes(section) || defaultIds.has(m.id)
    );
    const restoredDefaults = activeDefaults.filter((m) =>
      m.prefabs.includes(section) &&
      !currentMenus.some((cm) => cm.id === m.id)
    );
    menusVar([...resetMenus, ...restoredDefaults]);

    const defaults = defaultBindings[section];
    if (defaults) {
      const updated = {
        ...shortcutsVar(),
        [section]: { ...defaults },
      };
      shortcutsVar(updated);
      // Flush to localStorage synchronously so rebuilds from menu changes
      // don't reload stale values
      const filtered = filterNonDefaultBindings(updated);
      localStorage.setItem("shortcuts", JSON.stringify(filtered));
    }
  }, []);

  const sectionMatches = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const result: Record<string, Set<string>> = {};
    for (const [section, shortcuts] of Object.entries(sections)) {
      const matches = computeMatchingKeys(section, shortcuts, searchQuery);
      if (matches.size > 0) result[section] = matches;
    }
    return result;
  }, [searchQuery, sections]);

  const { useSlotBindings } = useReactiveVar(shortcutSettingsVar);
  const handleSlotBindingsChange = useCallback(
    (checked: boolean) =>
      shortcutSettingsVar({
        ...shortcutSettingsVar(),
        useSlotBindings: checked,
      }),
    [],
  );

  return (
    <>
      <SettingsPanelContainer>
        <Toolbar>
          <ToolbarTitle>{t("settings.tabShortcuts")}</ToolbarTitle>
          <SearchWrapper>
            <SearchIcon>
              <Search size={14} />
            </SearchIcon>
            <SearchInput
              placeholder={t("settings.bindingsSearch")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </SearchWrapper>
          {confirmingResetAll
            ? (
              <InlineConfirmBar>
                {t("settings.resetAllConfirm")}
                <DangerSmallButton
                  type="button"
                  onClick={() => {
                    handleResetAll();
                    setConfirmingResetAll(false);
                  }}
                >
                  {t("settings.resetAll")}
                </DangerSmallButton>
                <SmallButton
                  type="button"
                  onClick={() => setConfirmingResetAll(false)}
                >
                  {t("settings.cancel")}
                </SmallButton>
              </InlineConfirmBar>
            )
            : (
              <SmallButton
                type="button"
                onClick={() => setConfirmingResetAll(true)}
              >
                {t("settings.resetAll")}
              </SmallButton>
            )}
        </Toolbar>
        <Toggle
          checked={useSlotBindings}
          onChange={handleSlotBindingsChange}
        >
          {t("settings.useSlotBindings")}
        </Toggle>
        <SectionsContainer>
          {sectionMatches && Object.keys(sectionMatches).length === 0 && (
            <EmptySearch>
              {t("settings.bindingsNoResults", { query: searchQuery })}
            </EmptySearch>
          )}
          {sectionEntries
            .filter(([section]) => !sectionMatches || section in sectionMatches)
            .map(([section, shortcuts], index) => (
              <SettingsSection
                key={section}
                section={section}
                shortcuts={shortcuts}
                defaultOpen={index === 0 || !!sectionMatches}
                setBinding={(shortcut, binding) =>
                  handleSetBinding(section, shortcut, binding)}
                useSlotBindings={useSlotBindings}
                externalBindings={section === "controlGroups"
                  ? allPrefabBindings
                  : section !== "misc"
                  ? controlGroupBindings
                  : undefined}
                matchingKeys={sectionMatches?.[section] ?? null}
                onReset={() => handleResetSection(section)}
                onConflictsChange={handleConflictsChange}
              />
            ))}
        </SectionsContainer>
      </SettingsPanelContainer>

      {confirmDialog && (
        <Modal onClick={() => setConfirmDialog(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h3>{t("settings.applyToAll")}</h3>
            <p>
              {t("settings.applyToAllDesc", {
                action: getActionDisplayName(
                  confirmDialog.actionKey,
                  confirmDialog.section,
                ),
                count: confirmDialog.otherSections.length,
              })}
            </p>
            <UnitList>
              {confirmDialog.otherSections.map((s) => (
                <li key={s}>
                  {s === "misc"
                    ? t("settings.misc")
                    : s === "controlGroups"
                    ? t("settings.selectionGroups")
                    : prefabs[s]?.name ?? s}
                </li>
              ))}
            </UnitList>
            <p>{t("settings.applyToAllPrompt")}</p>
            <ModalButtons>
              <ModalButton type="button" onClick={applyToCurrentOnly}>
                {t("settings.currentOnly")}
              </ModalButton>
              <PrimaryButton type="button" onClick={applyToAll}>
                {t("settings.applyAll")}
              </PrimaryButton>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};
