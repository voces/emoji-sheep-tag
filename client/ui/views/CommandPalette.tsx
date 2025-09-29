//@deno-types="npm:@types/react"
import { useEffect, useMemo, useRef, useState } from "react";
import { styled } from "styled-components";
import { connect, send } from "../../client.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { addChatMessage } from "@/vars/chat.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { useMemoWithPrevious } from "@/hooks/useMemoWithPrevious.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { stateVar } from "@/vars/state.ts";
import { flags } from "../../flags.ts";
import { Card } from "@/components/layout/Card.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { getLocalPlayer } from "@/vars/players.ts";
import { editorVar } from "@/vars/editor.ts";
import { app, Entity, SystemEntity } from "../../ecs.ts";
import { DEFAULT_FACING } from "@/shared/constants.ts";
import { terrain } from "../../graphics/three.ts";
import { tileDefs } from "@/shared/data.ts";
import { packMap2D } from "@/shared/util/2dPacking.ts";
import { rad2deg } from "@/shared/util/math.ts";
import { packEntities } from "@/shared/util/entityPacking.ts";
import { loadLocal } from "../../local.ts";
import { center } from "@/shared/map.ts";

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

  &:hover,
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

type Command = {
  name: string;
  description: string;
  valid?: () => boolean;
  prompts?: string[];
  callback: (...args: string[]) => void;
};

type CommandOption =
  & Omit<Command, "name" | "description">
  & {
    originalName: string;
    name: (string | React.JSX.Element)[] | string;
    description: (string | React.JSX.Element)[] | string;
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
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState<string | undefined>();
  const [prompt, setPrompt] = useState("");
  const [inputs, setInputs] = useState<string[]>([]);

  const commands = useMemo((): Command[] => [
    {
      name: "Open editor",
      description: "Opens the map editor",
      valid: () => flags.debug && !editorVar() && stateVar() === "menu",
      callback: () => {
        editorVar(true);
        loadLocal();
        connect();
      },
    },
    {
      name: "Export map",
      description: "Exports the map as JS",
      valid: editorVar,
      callback: () => {
        const doodads = Array.from(app.entities).filter((
          e,
        ): e is SystemEntity<"isDoodad" | "prefab" | "position"> =>
          !!e.isDoodad && !!e.prefab && !!e.position
        );
        const entities: Record<string, Partial<Entity>[]> = {};
        for (const doodad of doodads) {
          if (!entities[doodad.prefab]) entities[doodad.prefab] = [];
          const stored: Partial<Entity> = { position: doodad.position };
          if (
            typeof doodad.modelScale === "number" && doodad.modelScale !== 1
          ) stored.modelScale = doodad.modelScale;
          if (
            typeof doodad.facing === "number" &&
            doodad.facing !== DEFAULT_FACING
          ) stored.facing = rad2deg(doodad.facing);
          if (doodad.playerColor) stored.playerColor = doodad.playerColor;
          if (typeof doodad.vertexColor === "number") {
            stored.vertexColor = doodad.vertexColor;
          }
          entities[doodad.prefab].push(stored);
        }

        let maxCliff = 0;
        const cliffs = terrain.masks.cliff.map((r) =>
          r.map((v) => {
            if (v === "r") return 0;
            if (v >= maxCliff) maxCliff = v;
            return v + 1;
          })
        ).reverse();

        console.log({
          center,
          terrain: packMap2D(
            terrain.masks.groundTile.toReversed(),
            tileDefs.length,
          ),
          cliffs: packMap2D(cliffs, maxCliff + 1),
          entities: packEntities(
            Array.from(app.entities).filter((e) =>
              e.isDoodad && e.prefab && e.position &&
              !e.id.startsWith("blueprint-")
            ),
          ),
        });
      },
    },
    {
      name: "Open settings",
      description: "Open setting menu",
      callback: () => showSettingsVar(true),
    },
    {
      name: "Cancel round",
      description: "Cancels the current round",
      valid: () =>
        stateVar() === "playing" && !!getLocalPlayer()?.host && !editorVar(),
      callback: () => send({ type: "cancel" }),
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
      prompts: ["Latency (MS)"],
      callback: (latency) =>
        addChatMessage(
          `Latency set to ${globalThis.latency = parseFloat(latency)}ms.`,
        ),
    },
    {
      name: "Set noise",
      description: "Artificially increase noise on latency",
      valid: () => flags.debug,
      prompts: ["Noise (MS)"],
      callback: (noise) =>
        addChatMessage(`Noise set to ${globalThis.noise = parseFloat(noise)}.`),
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
  ], [flags.debug, flags.debugStats, flags.debugPathing]);

  const filteredCommands = useMemoWithPrevious<CommandOption[]>((prev) => {
    if (prompt) return prev ?? [];
    const regexp = new RegExp(input.toLowerCase().split("").join(".*"), "i");
    const matches: CommandOption[] = [];
    for (let i = 0; i < commands.length && matches.length < 10; i++) {
      const command = commands[i];
      const nameMatches = command.name.match(regexp);
      const descriptionMatches = command.description.match(regexp);
      if (
        (typeof command.valid !== "function" || command.valid()) &&
        (nameMatches || descriptionMatches)
      ) {
        matches.push({
          ...command,
          originalName: command.name,
          name: nameMatches
            ? highlightText(command.name, input)
            : [command.name],
          description: descriptionMatches
            ? highlightText(command.description, input)
            : [command.description],
        } as CommandOption);
      }
    }
    return matches;
  }, [input, showCommandPalette]);

  useEffect(() => {
    if (
      !filteredCommands.some((c) => c.originalName === focused) &&
      filteredCommands.length
    ) {
      setFocused(filteredCommands[0]?.originalName);
    }
  }, [filteredCommands]);

  const close = () => {
    showCommandPaletteVar("closed");
    setTimeout(() => {
      setInputs([]);
      setInput("");
      setPrompt("");
    }, 100);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (showCommandPalette === "sent") {
      const command = filteredCommands.find((c) => c.originalName === focused);
      if (command) {
        if (command.prompts) {
          const curIdx = command.prompts.indexOf(prompt);
          if (curIdx < command.prompts.length - 1) {
            setPrompt(command.prompts[curIdx + 1]);
            setInput("");
            showCommandPaletteVar("open");
            if (curIdx !== -1) setInputs((prev) => [...prev, input]);
            return;
          }
        }
        command.callback(...inputs, input);
      }
      close();
    } else if (showCommandPalette === "dismissed") close();
    else if (showCommandPalette === "open") inputRef.current?.focus();
  }, [showCommandPalette]);

  return (
    <PaletteContainer
      $state={showCommandPalette}
      aria-hidden={showCommandPalette !== "open"}
    >
      <Input
        placeholder={prompt}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        ref={inputRef}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.code === "Enter") return showCommandPaletteVar("sent");
          if (prompt) return;
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
        onBlur={() => showCommandPaletteVar("dismissed")}
      />
      {!prompt && filteredCommands.map((c) => (
        <CommandOption
          key={c.originalName}
          $focused={focused === c.originalName}
          onClick={() => {
            setFocused(c.originalName);
            if (c.prompts?.length) {
              setPrompt(c.prompts[0]);
              setInput("");
            } else {
              c.callback();
              close();
            }
          }}
        >
          <div>{c.name}</div>
          <CommandDescription>{c.description}</CommandDescription>
        </CommandOption>
      ))}
    </PaletteContainer>
  );
};
