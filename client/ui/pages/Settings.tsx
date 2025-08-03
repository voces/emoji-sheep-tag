import { z } from "npm:zod";
import { keyboard } from "../../controls.ts";
import { pluck } from "../../util/pluck.ts";
import { makeVar, useReactiveVar } from "../hooks/useVar.tsx";
import { prefabs } from "../../../shared/data.ts";
//@deno-types="npm:@types/react"
import { useEffect, useState } from "react";
import { actionToShortcutKey } from "../../util/actionToShortcutKey.ts";
import { showSettingsVar } from "../vars/showSettings.ts";
import Collapse from "../components/Collapse.tsx";

const localStorageShortcuts = (() => {
  try {
    return JSON.parse(localStorage.getItem("shortcuts") ?? "") as unknown;
  } catch { /* do nothing */ }
})();

const zShortcut = z.string().array();
const pluckShortcut = (path: string) =>
  pluck(localStorageShortcuts, path, zShortcut);

type Shortcuts = Record<
  string,
  Record<string, string[]>
>;

const miscNames = {
  openCommandPalette: "Open command palette",
  openChat: "Open chat",
  cancel: "Cancel",
};

const defaultBindings: Shortcuts = {
  misc: {
    openCommandPalette: ["Slash"],
    openChat: ["Enter"],
    cancel: ["Backquote"],
  },
  ...Object.fromEntries(
    Object.entries(prefabs).filter(([, d]) => d.actions?.length).map((
      [u, d],
    ) => [
      u,
      Object.fromEntries(
        d.actions!.map((a) => [actionToShortcutKey(a), a.binding ?? []]),
      ),
    ]),
  ),
};

export const shortcutsVar = makeVar<Shortcuts>({
  misc: { // Potential conflict with a `misc` unitType?
    openCommandPalette: pluckShortcut("misc.openCommandPalette") ?? ["Slash"],
    openChat: pluckShortcut("misc.openChat") ?? ["Enter"],
    cancel: pluckShortcut("misc.cancel") ?? ["Backquote"],
  },
  ...Object.fromEntries(
    Object.entries(prefabs).filter(([, d]) => d.actions?.length).map((
      [u, d],
    ) => [
      u,
      Object.fromEntries(
        d.actions!.map((
          a,
        ) => [
          actionToShortcutKey(a),
          pluckShortcut(`${u}.${actionToShortcutKey(a)}`) ?? a.binding ?? [],
        ]),
      ),
    ]),
  ),
});

const formatShortcut = (shortcut: string[]) =>
  shortcut.map((v) =>
    v
      .replace("Slash", "/")
      .replace(/^Key/, "")
      .replace(/^Arrow/, "")
      .replace(/^Digit/, "")
      .replace(/^Numpad/, "#")
      .replace("Comma", ",")
      .replace("Period", ".")
      .replace("Period", ".")
      .replace("Enter", "↵")
      .replace("Backquote", "`")
  ).join(" + ");

const Section = (
  { section, shortcuts, setBinding }: {
    section: string;
    shortcuts: Record<string, string[]>;
    setBinding: (shortcut: string, binding: string[]) => Shortcuts;
  },
) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="v-stack">
      <h2 onClick={() => setIsOpen(!isOpen)} className="hover-highlight">
        <span style={{ display: "inline-block", width: "2ch" }}>
          {isOpen ? "▼" : "▶"}
        </span>
        {section === "misc" ? "Misc" : prefabs[section].name ?? section}
      </h2>
      <Collapse className="v-stack" isOpen={isOpen}>
        {Object.entries(shortcuts).map(([key, shortcut]) => (
          <div key={key} className="h-stack">
            <p style={{ flex: 1, flexBasis: 1 }}>
              {miscNames[key as keyof typeof miscNames] ??
                prefabs[section].actions?.find((a) =>
                  actionToShortcutKey(a) === key
                )?.name}
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
                  setBinding(
                    key,
                    Array.from(new Set([...Object.keys(keyboard), e.code])),
                  );
                  e.preventDefault();
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setBinding(key, defaultBindings[section][key])}
              >
                ↺
              </button>
            </div>
          </div>
        ))}
      </Collapse>
    </div>
  );
};

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
        <Section
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
