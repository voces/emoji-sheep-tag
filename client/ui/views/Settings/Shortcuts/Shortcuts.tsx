import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useCallback, useEffect, useState } from "react";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { SettingsSection } from "./SettingsSection.tsx";
import { SettingsPanelContainer } from "../commonStyles.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { shortcutSettingsVar } from "@/vars/shortcutSettings.ts";
import {
  defaultBindings,
  getActionDisplayName,
  getEffectiveDefault,
  isAltKey,
  isDefaultBinding,
} from "@/util/shortcutUtils.ts";
import { styled } from "styled-components";
import { Button } from "@/components/forms/Button.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { prefabs } from "@/shared/data.ts";
import { menusVar } from "@/vars/menus.ts";

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
    if (section === currentSection || section === "misc") continue;
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled(VStack)`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 20px;
  border-radius: 4px;
  max-width: 400px;
  gap: 16px;
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const UnitList = styled.ul`
  max-height: 200px;
  overflow-y: auto;
  padding-left: 20px;
`;

type ConfirmDialogState = {
  section: string;
  actionKey: string;
  binding: string[];
  otherSections: string[];
} | null;

export const Shortcuts = () => {
  const sections = useReactiveVar(shortcutsVar);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

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
  const { useSlotBindings } = useReactiveVar(shortcutSettingsVar);
  const handleSlotBindingsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      shortcutSettingsVar({
        ...shortcutSettingsVar(),
        useSlotBindings: e.target.checked,
      }),
    [],
  );

  return (
    <>
      <SettingsPanelContainer>
        <label
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Checkbox
            id="use-slot-bindings"
            checked={useSlotBindings}
            onChange={handleSlotBindingsChange}
          />
          Use item slot bindings
        </label>
        {sectionEntries.map(([section, shortcuts], index) => (
          <SettingsSection
            key={section}
            section={section}
            shortcuts={shortcuts}
            defaultOpen={index === 0}
            setBinding={(shortcut, binding) =>
              handleSetBinding(section, shortcut, binding)}
            useSlotBindings={useSlotBindings}
          />
        ))}
      </SettingsPanelContainer>

      {confirmDialog && (
        <Modal onClick={() => setConfirmDialog(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h3>Apply to all units?</h3>
            <p>
              The action "{getActionDisplayName(
                confirmDialog.actionKey,
                confirmDialog.section,
              )}" exists on {confirmDialog.otherSections.length}{" "}
              other unit{confirmDialog.otherSections.length > 1 ? "s" : ""}:
            </p>
            <UnitList>
              {confirmDialog.otherSections.map((s) => (
                <li key={s}>{s === "misc" ? "Misc" : prefabs[s]?.name ?? s}</li>
              ))}
            </UnitList>
            <p>Do you want to apply this binding to all of them?</p>
            <ModalButtons>
              <Button type="button" onClick={applyToCurrentOnly}>
                Current only
              </Button>
              <Button type="button" onClick={applyToAll}>
                Apply to all
              </Button>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};
