import { useReactiveVar } from "@/hooks/useVar.tsx";
//@deno-types="npm:@types/react"
import { useEffect } from "react";
import { styled } from "styled-components";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { SettingsSection } from "./SettingsSection.tsx";
import { VStack } from "@/components/layout/Layout.tsx";

const ShortcutsContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.lg};
  max-height: 100%;
  overflow: auto;
  padding-right: ${({ theme }) => theme.spacing.lg};
`;

export const Shortcuts = () => {
  const sections = useReactiveVar(shortcutsVar);

  useEffect(() => {
    localStorage.setItem("shortcuts", JSON.stringify(sections));
  }, [sections]);

  return (
    <ShortcutsContainer>
      {Object.entries(sections).map(([section, shortcuts]) => (
        <SettingsSection
          key={section}
          section={section}
          shortcuts={shortcuts}
          setBinding={(shortcut, binding) =>
            shortcutsVar({
              ...sections,
              [section]: { ...shortcuts, [shortcut]: binding },
            })}
        />
      ))}
    </ShortcutsContainer>
  );
};
