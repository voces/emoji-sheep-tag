import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useEffect } from "react";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { SettingsSection } from "./SettingsSection.tsx";
import { SettingsPanelContainer } from "./commonStyles.tsx";

export const Shortcuts = () => {
  const sections = useReactiveVar(shortcutsVar);

  useEffect(() => {
    localStorage.setItem("shortcuts", JSON.stringify(sections));
  }, [sections]);

  const sectionEntries = Object.entries(sections);

  return (
    <SettingsPanelContainer>
      {sectionEntries.map(([section, shortcuts], index) => (
        <SettingsSection
          key={section}
          section={section}
          shortcuts={shortcuts}
          defaultOpen={index === 0}
          setBinding={(shortcut, binding) =>
            shortcutsVar({
              ...sections,
              [section]: { ...shortcuts, [shortcut]: binding },
            })}
        />
      ))}
    </SettingsPanelContainer>
  );
};
