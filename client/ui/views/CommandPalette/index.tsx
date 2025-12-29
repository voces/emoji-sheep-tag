import { useEffect, useMemo, useRef, useState } from "react";
import { styled } from "styled-components";
import { send } from "../../../client.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { addChatMessage } from "@/vars/chat.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { useMemoWithPrevious } from "@/hooks/useMemoWithPrevious.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { stateVar } from "@/vars/state.ts";
import { flags } from "../../../flags.ts";
import { Card } from "@/components/layout/Card.tsx";
import { Input } from "@/components/forms/Input.tsx";
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
import { openEditor } from "@/util/openEditor.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { mouse, MouseButtonEvent } from "../../../mouse.ts";
import { practiceVar } from "@/vars/practice.ts";

const PaletteContainer = styled(Card)<{ $state: string }>`
  position: absolute;
  top: 20px;
  width: 400px;
  left: calc(50% - 200px);
  opacity: ${({ $state }) => $state === "open" ? 1 : 0};
  transition: all 100ms ease-in-out;
  pointer-events: ${({ $state }) => $state === "open" ? "initial" : "none"};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const CommandOption = styled.div<{ $focused?: boolean }>`
  background-color: ${({ $focused, theme }) =>
    $focused ? theme.colors.shadow : "transparent"};
  margin: ${({ $focused, theme }) => $focused ? `0 -${theme.spacing.lg}` : "0"};
  padding: ${({ $focused, theme }) => $focused ? `0 ${theme.spacing.lg}` : "0"};
  cursor: pointer;

  &.hover {
    background-color: ${({ theme }) => theme.colors.shadow};
    margin: ${({ theme }) => `0 -${theme.spacing.lg}`};
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

const CommandDescription = styled.div`
  font-size: 70%;
  color: color-mix(in oklab, ${({ theme }) =>
    theme.colors.body} 70%, transparent);
`;

const Highlight = styled.span`
  color: color-mix(
    in oklab,
    ${({ theme }) => theme.colors.body} 30%,
    ${({ theme }) => theme.colors.primary}
  );
`;

type CommandResult =
  | void
  | { type: "prompt"; placeholder: string; callback: (value: string) => void }
  | { type: "options"; placeholder: string; commands: Command[] };

type Command = {
  name: string;
  description?: string;
  valid?: () => boolean;
  callback: () => CommandResult | Promise<CommandResult>;
};

type FilteredCommand =
  & Omit<Command, "name" | "description">
  & {
    originalName: string;
    name: (string | React.JSX.Element)[] | string;
    description?: (string | React.JSX.Element)[] | string;
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

  const copyMap = useCopyMap();
  const selectMap = useSelectMap();
  const saveMapAs = useSaveMapAs();
  const quickSaveMap = useQuickSaveMap();

  const practice = useReactiveVar(practiceVar);

  const commands = useMemo((): Command[] => [
    {
      name: "Cancel round",
      description: "Cancels the current round",
      valid: () => stateVar() === "playing" && isLocalPlayerHost() && !isEditor,
      callback: () => send({ type: "cancel" }),
    },
    {
      name: "Reset gold",
      description: "Sets all players' gold to 0",
      valid: () => practice && isLocalPlayerHost(),
      callback: () => send({ type: "resetGold" }),
    },
    ...(!isEditor
      ? [{
        name: "Open settings",
        description: "Open setting menu",
        callback: () => showSettingsVar(true),
      }]
      : []),
    {
      name: "Open editor",
      description: "Opens the map editor",
      valid: () => !isEditor && stateVar() === "menu",
      callback: openEditor,
    },
    ...((currentMap && !MAPS.find((m) => m.id === currentMap.id))
      ? [quickSaveMap, saveMapAs, copyMap, selectMap]
      : mapModified
      ? [saveMapAs, copyMap, selectMap]
      : [selectMap, copyMap]),
    ...(isEditor
      ? [
        {
          name: `${lobbySettings.view ? "Enable" : "Disable"} fog`,
          description: `${
            lobbySettings.view ? "Enable" : "Disable"
          } fog of war in the editor`,
          callback: () =>
            send({ type: "lobbySettings", view: !lobbySettings.view }),
        },
        {
          name: `${hideUI ? "Show" : "Hide"} UI`,
          description: `${
            hideUI ? "Show" : "Hide"
          } game UI elements in the editor`,
          callback: () => editorHideUIVar(!hideUI),
        },
        {
          name: "Open settings",
          description: "Open setting menu",
          callback: () => showSettingsVar(true),
        },
      ]
      : []),
    {
      name: `${uiSettings.showPing ? "Hide" : "Show"} ping`,
      description: `${
        uiSettings.showPing ? "Hide" : "Show"
      } network latency indicator`,
      callback: () => {
        uiSettingsVar({
          ...uiSettings,
          showPing: !uiSettings.showPing,
        });
      },
    },
    {
      name: `${uiSettings.showFps ? "Hide" : "Show"} FPS`,
      description: `${
        uiSettings.showFps ? "Hide" : "Show"
      } frames per second counter`,
      callback: () => {
        uiSettingsVar({
          ...uiSettings,
          showFps: !uiSettings.showFps,
        });
      },
    },
    {
      name: `${flags.debug ? "Disable" : "Enable"} debugging`,
      description: flags.debug
        ? "Disable debugging and hide debug commands."
        : "Show debug commands.",
      callback: () => {
        flags.debug = !flags.debug;
        const stats = document.getElementById("stats");
        if (!flags.debug) {
          localStorage.removeItem("debug");
          globalThis.latency = 0;
          globalThis.noise = 0;
          if (stats) stats.style.display = "none";
        } else {
          localStorage.setItem("debug", "true");
          if (stats) stats.style.display = flags.debugStats ? "" : "none";
        }
      },
    },
    {
      name: "Set latency",
      description: "Artificially increase latency",
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Latency (MS)",
        callback: (latency: string) =>
          addChatMessage(
            `Latency set to ${globalThis.latency = parseFloat(latency)}ms.`,
          ),
      }),
    },
    {
      name: "Set noise",
      description: "Artificially increase noise on latency",
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Noise (MS)",
        callback: (noise: string) =>
          addChatMessage(
            `Noise set to ${globalThis.noise = parseFloat(noise)}ms.`,
          ),
      }),
    },
    {
      name: `${flags.debugStats ? "Hide" : "Show"} stats`,
      description: `${
        flags.debugStats ? "Hide" : "Show"
      } latency, memory, and frames per second`,
      valid: () => flags.debug,
      callback: () => {
        flags.debugStats = !flags.debugStats;
        if (flags.debugStats) localStorage.setItem("debug-stats", "true");
        else localStorage.removeItem("debug-stats");

        const stats = document.getElementById("stats");
        if (stats) stats.style.display = flags.debugStats ? "" : "none";
      },
    },
    {
      name: `${flags.debugPathing ? "Disable" : "Enable"} path debugging`,
      description: `${flags.debugPathing ? "Hide" : "Show"} pathing traces`,
      valid: () => flags.debug,
      callback: () => {
        flags.debugPathing = !flags.debugPathing;
        if (flags.debugPathing) localStorage.setItem("debug-pathing", "true");
        else localStorage.removeItem("debug-pathing");
      },
    },
  ], [
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
    flags.debugStats,
    flags.debugPathing,
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
    for (let i = 0; i < sourceList.length && matches.length < 10; i++) {
      const command = sourceList[i];
      const nameMatches = command.name.match(regexp);
      const descriptionMatches = command.description?.match(regexp);
      if (nameMatches || descriptionMatches) {
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
    mouse.addEventListener("mouseButtonDown", listener);
    return () => mouse.removeEventListener("mouseButtonDown", listener);
  }, []);

  return (
    <PaletteContainer
      $state={showCommandPalette}
      aria-hidden={showCommandPalette !== "open"}
      data-command-palette
    >
      <Input
        placeholder={prompt}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        ref={inputRef}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.code === "Enter") return showCommandPaletteVar("sent");
          // Don't allow navigation when showing a text prompt
          if (promptCallback) return;
          if (e.code === "ArrowUp" && filteredCommands.length) {
            setFocused(
              filteredCommands.at(
                filteredCommands.findIndex((c) => c.originalName === focused) -
                  1,
              )?.originalName,
            );
          } else if (e.code === "ArrowDown" && filteredCommands.length) {
            setFocused(
              filteredCommands[
                (filteredCommands.findIndex((c) => c.originalName === focused) +
                  1) % filteredCommands.length
              ]?.originalName,
            );
          }
        }}
      />
      {!promptCallback &&
        filteredCommands.map((c) => (
          <CommandOption
            key={c.originalName}
            $focused={focused === c.originalName}
            onClick={() => {
              setFocused(c.originalName);
              showCommandPaletteVar("sent");
            }}
          >
            <div>{c.name}</div>
            {c.description && (
              <CommandDescription>{c.description}</CommandDescription>
            )}
          </CommandOption>
        ))}
    </PaletteContainer>
  );
};
