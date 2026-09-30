import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { useMemoWithPrevious } from "@/hooks/useMemoWithPrevious.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import { Panel } from "@/components/Panel.tsx";
import { fuzzyScore, highlightText } from "@/util/fuzzyMatch.tsx";
import { Command, CommandResult, useCommands } from "./useCommands.ts";
import { mouse, MouseButtonEvent } from "../../../mouse.ts";

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

type FilteredCommand =
  & Omit<Command, "name" | "description">
  & {
    originalName: string;
    name: (string | React.JSX.Element)[] | string;
    description?: (string | React.JSX.Element)[] | string;
    group?: string;
  };

export const CommandPalette = () => {
  const showCommandPalette = useReactiveVar(showCommandPaletteVar);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState<string | undefined>();
  const [prompt, setPrompt] = useState("");
  const [nestedCommands, setNestedCommands] = useState<Command[]>([]);
  const [promptCallback, setPromptCallback] = useState<
    | ((value: string) => void | CommandResult | Promise<void | CommandResult>)
    | null
  >(null);

  const { t } = useTranslation();
  const commands = useCommands();

  const filteredCommands = useMemoWithPrevious<FilteredCommand[]>((prev) => {
    // If we're showing a text prompt (not options), keep previous commands
    if (prompt && !nestedCommands.length) return prev ?? [];

    const sourceList = nestedCommands.length
      ? nestedCommands
      : commands.filter((cmd) =>
        typeof cmd.valid !== "function" || cmd.valid()
      );

    const scored: {
      command: Command;
      score: number;
      nameScore: number | null;
      descScore: number | null;
    }[] = [];
    for (let i = 0; i < sourceList.length; i++) {
      const command = sourceList[i];
      const nameScore = fuzzyScore(command.name, input);
      const descScore = command.description
        ? fuzzyScore(command.description, input)
        : null;
      const searchScore = command.searchTerms
        ? fuzzyScore(command.searchTerms, input)
        : null;

      const best = Math.max(
        nameScore ?? -Infinity,
        descScore ?? -Infinity,
        searchScore ?? -Infinity,
      );
      if (!Number.isFinite(best)) continue;

      const nameBonus = nameScore !== null ? 1000 : 0;
      scored.push({
        command,
        score: best + nameBonus,
        nameScore,
        descScore,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.map(({ command, nameScore, descScore }) => ({
      ...command,
      originalName: command.name,
      name: nameScore !== null
        ? highlightText(command.name, input)
        : [command.name],
      description: command.description
        ? (descScore !== null
          ? highlightText(command.description, input)
          : [command.description])
        : undefined,
    } as FilteredCommand));
  }, [input, showCommandPalette, nestedCommands, prompt, commands]);

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

  const applyResult = (res: CommandResult) => {
    if (res?.type !== "prompt" && res?.type !== "options") return close();
    setPrompt(res.placeholder);
    setInput("");
    if (res.type === "prompt") setPromptCallback(() => res.callback);
    else {
      setNestedCommands(res.commands);
      setPromptCallback(null);
    }
    showCommandPaletteVar("open");
  };

  useEffect(() => {
    if (showCommandPalette === "sent") {
      const run = promptCallback
        ? () => promptCallback(input)
        : filteredCommands.find((c) => c.originalName === focused)?.callback;
      if (run) Promise.resolve(run()).then(applyResult);
      else close();
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
          maxLength={128}
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
