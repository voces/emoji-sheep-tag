import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { send } from "../../../messaging.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { addChatMessage } from "@/vars/chat.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { useMemoWithPrevious } from "@/hooks/useMemoWithPrevious.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { stateVar } from "@/vars/state.ts";
import { flags } from "../../../flags.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import { Panel } from "@/components/Panel.tsx";
import { isLocalPlayerHost } from "../../../api/player.ts";
import {
  editorCurrentMapVar,
  editorHideUIVar,
  editorMapModifiedVar,
  editorVar,
} from "@/vars/editor.ts";
import { useCopyMap } from "./useCopyMap.ts";
import { useSelectMap } from "./useSelectMap.ts";
import { useSaveMapAs } from "./useSaveMapAs.ts";
import { useQuickSaveMap } from "./useQuickSaveMap.ts";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { mouse, MouseButtonEvent } from "../../../mouse.ts";
import { practiceVar } from "@/vars/practice.ts";
import { disconnect, isMultiplayer } from "../../../connection.ts";
import { unloadEcs } from "../../../ecs.ts";
import { connectionStatusVar } from "@/vars/state.ts";
import { generateDoodads } from "@/shared/map.ts";

const PaletteContainer = styled(Panel)<{ $state: string }>`
  position: absolute;
  top: 20px;
  width: min(600px, calc(100vw - 48px));
  left: 50%;
  transform: translateX(-50%);
  max-height: 70vh;
  opacity: ${({ $state }) => $state === "open" ? 1 : 0};
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeInOut};
  pointer-events: ${({ $state }) => $state === "open" ? "initial" : "none"};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border-color: ${({ theme }) => theme.border.hi};
  box-shadow: ${({ theme }) => theme.shadow.lg}, ${({ theme }) =>
    theme.shadow.inset};
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[3]} 14px;
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  background: ${({ theme }) => theme.surface[0]};
`;

const InputPrefix = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.lg};
  line-height: 1;
`;

const PaletteInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.lg};
  outline: none;
  padding: 0;
`;

const CommandList = styled.div`
  overflow-y: auto;
  padding: ${({ theme }) => theme.space[1]};
  flex: 1;
  min-height: 0;
`;

const CommandOption = styled.div<{ $focused?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  background: ${({ $focused, theme }) =>
    $focused ? theme.accent.bg : "transparent"};
  border: 1px solid ${({ $focused, theme }) =>
    $focused
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 35%, ${theme.border.DEFAULT})`
      : "transparent"};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;

  &.hover {
    background: ${({ theme }) => theme.accent.bg};
  }
`;

const CommandLabel = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  color: ${({ theme }) => theme.ink.hi};
`;

const CommandDescription = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

const GroupLabel = styled.div`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]} ${(
    { theme },
  ) => theme.space[1]};
  font-size: ${({ theme }) => theme.text.xs};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.ink.lo};
  font-weight: 500;
`;

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.space[10]};
  text-align: center;
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.sm};
`;

const Footer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[4]};
  padding: 10px 14px;
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  background: ${({ theme }) => theme.surface[0]};
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};

  & > span {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[1]};
  }
`;

const Highlight = styled.span`
  color: ${({ theme }) => theme.accent.DEFAULT};
`;

type CommandResult =
  | void
  | { type: "prompt"; placeholder: string; callback: (value: string) => void }
  | { type: "options"; placeholder: string; commands: Command[] };

type Command = {
  name: string;
  description?: string;
  group?: string;
  searchTerms?: string;
  valid?: () => boolean;
  callback: () => CommandResult | Promise<CommandResult>;
};

type FilteredCommand =
  & Omit<Command, "name" | "description">
  & {
    originalName: string;
    name: (string | React.JSX.Element)[] | string;
    description?: (string | React.JSX.Element)[] | string;
    group?: string;
  };

const highlightText = (text: string, query: string) => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;
  const result = [];

  // Loop through each character in the query
  for (let i = 0; i < lowerQuery.length; i++) {
    const char = lowerQuery[i];
    // Find the next occurrence of the character starting from lastIndex
    const matchIndex = lowerText.indexOf(char, lastIndex);
    if (matchIndex === -1) {
      // If a character from the query isn't found, stop highlighting.
      break;
    }
    // Append any text between the previous match and this one (not highlighted)
    if (matchIndex > lastIndex) {
      result.push(text.slice(lastIndex, matchIndex));
    }
    // Append the matched character wrapped in a span for highlighting
    result.push(
      <Highlight key={matchIndex}>
        {text.charAt(matchIndex)}
      </Highlight>,
    );
    lastIndex = matchIndex + 1;
  }
  // Append the remaining part of the text after the last match
  result.push(text.slice(lastIndex));
  return result;
};

export const CommandPalette = () => {
  const showCommandPalette = useReactiveVar(showCommandPaletteVar);
  const uiSettings = useReactiveVar(uiSettingsVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const currentMap = useReactiveVar(editorCurrentMapVar);
  const mapModified = useReactiveVar(editorMapModifiedVar);
  const isEditor = useReactiveVar(editorVar);
  const hideUI = useReactiveVar(editorHideUIVar);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState<string | undefined>();
  const [prompt, setPrompt] = useState("");
  const [nestedCommands, setNestedCommands] = useState<Command[]>([]);
  const [promptCallback, setPromptCallback] = useState<
    | ((value: string) => void | CommandResult | Promise<void | CommandResult>)
    | null
  >(null);

  const { t, i18n } = useTranslation();
  const copyMap = useCopyMap();
  const selectMap = useSelectMap();
  const saveMapAs = useSaveMapAs();
  const quickSaveMap = useQuickSaveMap();

  const practice = useReactiveVar(practiceVar);

  const commands = useMemo((): Command[] => [
    ...(isEditor
      ? [
        ...((currentMap && !MAPS.find((m) => m.id === currentMap.id))
          ? [quickSaveMap, saveMapAs, copyMap, selectMap]
          : mapModified
          ? [saveMapAs, copyMap, selectMap]
          : [selectMap, copyMap]).map((c) => ({
            ...c,
            group: t("commands.groupEditor"),
          })),
        {
          name: t(
            lobbySettings.view ? "commands.enableFog" : "commands.disableFog",
          ),
          description: t("commands.fogDesc"),
          group: t("commands.groupEditor"),
          callback: () =>
            send({ type: "lobbySettings", view: !lobbySettings.view }),
        },
        {
          name: t(hideUI ? "commands.showUI" : "commands.hideUI"),
          description: t("commands.uiDesc"),
          group: t("commands.groupEditor"),
          callback: () => editorHideUIVar(!hideUI),
        },
      ]
      : []),
    {
      name: t("commands.cancelRound"),
      description: t("commands.cancelRoundDesc"),
      group: t("commands.groupRound"),
      valid: () => stateVar() === "playing" && isLocalPlayerHost() && !isEditor,
      callback: () => send({ type: "cancel" }),
    },
    {
      name: t("commands.resetGold"),
      description: t("commands.resetGoldDesc"),
      group: t("commands.groupRound"),
      valid: () => practice && isLocalPlayerHost(),
      callback: () => send({ type: "resetGold" }),
    },
    {
      name: t(
        lobbySettings.view ? "commands.enableFog" : "commands.disableFog",
      ),
      description: t("commands.fogDesc"),
      group: t("commands.groupRound"),
      valid: () => practice && isLocalPlayerHost() && !isEditor,
      callback: () =>
        send({ type: "lobbySettings", view: !lobbySettings.view }),
    },
    {
      name: t("commands.leaveLobby"),
      description: t("commands.leaveLobbyDesc"),
      group: t("commands.groupNavigate"),
      valid: () =>
        (stateVar() === "lobby" || stateVar() === "playing") && !isEditor &&
        isMultiplayer(),
      callback: () => send({ type: "leaveLobby" }),
    },
    {
      name: t("commands.exitToMenu"),
      description: t("commands.exitToMenuDesc"),
      group: t("commands.groupNavigate"),
      valid: () => stateVar() !== "menu" && !isEditor,
      callback: () => {
        disconnect();
        stateVar("menu");
        unloadEcs({ includePlayers: true });
        generateDoodads(["dynamic"]);
        connectionStatusVar("notConnected");
      },
    },
    {
      name: t("commands.openSettings"),
      description: t("commands.openSettingsDesc"),
      group: t("commands.groupNavigate"),
      callback: () => showSettingsVar(true),
    },
    {
      name: t(
        uiSettings.showPing ? "commands.hidePing" : "commands.showPing",
      ),
      description: t("commands.pingDesc"),
      group: t("commands.groupDisplay"),
      callback: () =>
        uiSettingsVar({ ...uiSettings, showPing: !uiSettings.showPing }),
    },
    {
      name: t(uiSettings.showFps ? "commands.hideFps" : "commands.showFps"),
      description: t("commands.fpsDesc"),
      group: t("commands.groupDisplay"),
      callback: () =>
        uiSettingsVar({ ...uiSettings, showFps: !uiSettings.showFps }),
    },
    {
      name: t("commands.setLatency"),
      description: t("commands.setLatencyDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Latency (MS)",
        callback: (latency: string) => {
          const value = parseFloat(latency) || 0;
          globalThis.latency = value;
          addChatMessage(`Latency set to ${value}ms.`);
        },
      }),
    },
    {
      name: t("commands.setNoise"),
      description: t("commands.setNoiseDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Noise (MS)",
        callback: (noise: string) => {
          const value = parseFloat(noise) || 0;
          globalThis.noise = value;
          addChatMessage(`Noise set to ${value}ms.`);
        },
      }),
    },
    {
      name: t(
        flags.debugPathing
          ? "commands.disablePathDebug"
          : "commands.enablePathDebug",
      ),
      description: t("commands.pathDebugDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => {
        flags.debugPathing = !flags.debugPathing;
        if (flags.debugPathing) localStorage.setItem("debug-pathing", "true");
        else localStorage.removeItem("debug-pathing");
      },
    },
    {
      name: t(
        i18n.language === "pseudo"
          ? "commands.disablePseudo"
          : "commands.enablePseudo",
      ),
      description: t("commands.pseudoDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () =>
        i18n.changeLanguage(i18n.language === "pseudo" ? "en" : "pseudo"),
    },
  ], [
    t,
    copyMap,
    selectMap,
    saveMapAs,
    quickSaveMap,
    currentMap,
    mapModified,
    isEditor,
    hideUI,
    lobbySettings.view,
    flags.debug,
    flags.debugPathing,
    i18n.language,
    uiSettings.showPing,
    uiSettings.showFps,
    practice,
  ]);

  const filteredCommands = useMemoWithPrevious<FilteredCommand[]>((prev) => {
    // If we're showing a text prompt (not options), keep previous commands
    if (prompt && !nestedCommands.length) return prev ?? [];

    const sourceList = nestedCommands.length
      ? nestedCommands
      : commands.filter((cmd) =>
        typeof cmd.valid !== "function" || cmd.valid()
      );

    const regexp = new RegExp(input.toLowerCase().split("").join(".*"), "i");
    const matches: FilteredCommand[] = [];
    for (let i = 0; i < sourceList.length; i++) {
      const command = sourceList[i];
      const nameMatches = command.name.match(regexp);
      const descriptionMatches = command.description?.match(regexp);
      const searchMatches = command.searchTerms?.match(regexp);
      if (nameMatches || descriptionMatches || searchMatches) {
        matches.push({
          ...command,
          originalName: command.name,
          name: nameMatches
            ? highlightText(command.name, input)
            : [command.name],
          description: command.description
            ? (descriptionMatches
              ? highlightText(command.description, input)
              : [command.description])
            : undefined,
        } as FilteredCommand);
      }
    }
    return matches;
  }, [input, showCommandPalette, nestedCommands, prompt]);

  const groupedCommands = useMemo(() => {
    const groups: { group: string; items: FilteredCommand[] }[] = [];
    for (const c of filteredCommands) {
      const g = c.group ?? "";
      const last = groups.at(-1);
      if (last && last.group === g) last.items.push(c);
      else groups.push({ group: g, items: [c] });
    }
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (
      showCommandPalette === "open" &&
      !filteredCommands.some((c) => c.originalName === focused) &&
      filteredCommands.length
    ) setFocused(filteredCommands[0]?.originalName);
  }, [showCommandPalette, filteredCommands]);

  const close = () => {
    showCommandPaletteVar("closed");
    setTimeout(() => {
      setInput("");
      setPrompt("");
      setNestedCommands([]);
      setPromptCallback(null);
    }, 100);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (showCommandPalette === "sent") {
      // If we're in a prompt state, handle the input
      if (promptCallback) {
        const result = promptCallback(input);
        Promise.resolve(result).then((res) => {
          if (res && res.type === "prompt") {
            setPrompt(res.placeholder);
            setPromptCallback(() => res.callback);
            setInput("");
            showCommandPaletteVar("open");
          } else if (res && res.type === "options") {
            setPrompt(res.placeholder);
            setNestedCommands(res.commands);
            setInput("");
            setPromptCallback(null);
            showCommandPaletteVar("open");
          } else {
            close();
          }
        });
        return;
      }

      const command = filteredCommands.find((c) => c.originalName === focused);

      if (command) {
        const result = command.callback();
        Promise.resolve(result).then((res) => {
          if (res?.type === "prompt") {
            setPrompt(res.placeholder);
            setPromptCallback(() => res.callback);
            setInput("");
            showCommandPaletteVar("open");
          } else if (res?.type === "options") {
            setPrompt(res.placeholder);
            setNestedCommands(res.commands);
            setInput("");
            showCommandPaletteVar("open");
          } else close();
        });
      } else {
        close();
      }
    } else if (showCommandPalette === "dismissed") close();
    else if (showCommandPalette === "open") inputRef.current?.focus();
  }, [showCommandPalette, promptCallback, input, filteredCommands, focused]);

  useEffect(() => {
    const listener = (e: MouseButtonEvent) => {
      if (e.element?.closest("[data-command-palette]")) return;
      showCommandPaletteVar((p) => p === "open" ? "dismissed" : p);
    };
    mouse.addEventListener("mouseButtonUp", listener);
    return () => mouse.removeEventListener("mouseButtonUp", listener);
  }, []);

  const shortcuts = shortcutsVar();
  const openKey = shortcuts.misc.openCommandPalette;

  return (
    <PaletteContainer
      $state={showCommandPalette}
      aria-hidden={showCommandPalette !== "open"}
      data-command-palette
      data-overlay="true"
    >
      <InputRow>
        <InputPrefix>›</InputPrefix>
        <PaletteInput
          placeholder={prompt || t("commands.searchPlaceholder")}
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInput(e.target.value)}
          ref={inputRef}
          onKeyDown={(e: React.KeyboardEvent) => {
            e.stopPropagation();
            if (e.key === "Enter") return showCommandPaletteVar("sent");
            if (promptCallback) return;
            if (e.code === "ArrowUp" && filteredCommands.length) {
              e.preventDefault();
              setFocused(
                filteredCommands.at(
                  filteredCommands.findIndex((c) =>
                    c.originalName === focused
                  ) - 1,
                )?.originalName,
              );
            } else if (e.code === "ArrowDown" && filteredCommands.length) {
              e.preventDefault();
              setFocused(
                filteredCommands[
                  (filteredCommands.findIndex((c) =>
                    c.originalName === focused
                  ) + 1) % filteredCommands.length
                ]?.originalName,
              );
            }
          }}
        />
      </InputRow>
      <CommandList>
        {!promptCallback &&
          groupedCommands.map(({ group, items }, gi) => (
            <div key={`${group}-${gi}`}>
              {group && <GroupLabel>{group}</GroupLabel>}
              {items.map((c) => (
                <CommandOption
                  key={c.originalName}
                  $focused={focused === c.originalName}
                  ref={focused === c.originalName
                    ? (el: HTMLDivElement | null) =>
                      el?.scrollIntoView({ block: "nearest" })
                    : undefined}
                  onMouseEnter={() => setFocused(c.originalName)}
                  onClick={() => {
                    setFocused(c.originalName);
                    showCommandPaletteVar("sent");
                  }}
                >
                  <CommandLabel>{c.name}</CommandLabel>
                  {c.description && (
                    <CommandDescription>{c.description}</CommandDescription>
                  )}
                </CommandOption>
              ))}
            </div>
          ))}
        {!promptCallback && filteredCommands.length === 0 && (
          <EmptyState>
            {t("commands.noResults", { query: input })}
          </EmptyState>
        )}
      </CommandList>
      <Footer>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> {t("commands.navigate")}
        </span>
        <span>
          <kbd>↵</kbd> {t("commands.run")}
        </span>
        {openKey && (
          <span>
            <kbd>{formatShortcut(openKey)}</kbd> {t("commands.toOpen")}
          </span>
        )}
      </Footer>
    </PaletteContainer>
  );
};
