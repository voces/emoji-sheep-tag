import { makeVar, useReactiveVar } from "../hooks/useVar.tsx";
//@deno-types="npm:@types/react"
import { useEffect } from "react";
import { showSettingsVar } from "../vars/showSettings.ts";
import { SettingsSection } from "../components/SettingsSection.tsx";
import { type Shortcuts, createInitialShortcuts } from "../util/shortcutUtils.ts";

export const shortcutsVar = makeVar<Shortcuts>(createInitialShortcuts());

const Shortcuts = () => {
  const sections = useReactiveVar(shortcutsVar);

  useEffect(() => {
    localStorage.setItem("shortcuts", JSON.stringify(sections));
  }, [sections]);

  return (
    <div
      className="v-stack"
      style={{
        flex: 2.5,
        gap: 16,
        maxHeight: "calc(100vh - 200px)",
        overflow: "auto",
      }}
    >
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
    </div>
  );
};

export const Settings = () => {
  const showSettings = useReactiveVar(showSettingsVar);

  if (!showSettings) return null;

  return (
    <div className="overlay">
      <div
        className="card abs-center v-stack"
        style={{ width: 700, maxWidth: "calc(100% - 16px)", gap: 24 }}
      >
        <h1>Settings</h1>
        <div className="h-stack">
          <div className="v-stack" style={{ flex: 1 }}>
            <p>Shortcuts</p>
          </div>
          <Shortcuts />
        </div>
        <button
          type="button"
          style={{ marginLeft: "auto", padding: "0 32px" }}
          onClick={() => showSettingsVar(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
};
