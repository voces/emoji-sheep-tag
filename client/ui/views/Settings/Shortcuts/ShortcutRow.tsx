import { memo, useCallback } from "react";
import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import {
  bindingsEqual,
  type ConflictInfo,
  defaultBindings,
  getActionDisplayName,
  getAltIndex,
  getBaseKey,
  getEffectiveDefault,
  getPresetAltDefaults,
  isAltKey,
  isDefaultBinding,
  makeAltKey,
} from "@/util/shortcutUtils.ts";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { IconButton } from "@/components/forms/IconButton.tsx";
import { ShortcutInputField } from "./ShortcutInputField.tsx";
import { ConflictWarning } from "./ConflictWarning.tsx";
import { getDragData, startDrag } from "./useDragState.ts";
import { Command } from "@/components/game/Command.tsx";
import { getActionIcon } from "./menuActionHelpers.ts";
import { colors } from "@/shared/data.ts";

const ShortcutRowContainer = styled(HStack)<{
  $isNested?: boolean;
  $isDraggable?: boolean;
  $enableHover?: boolean;
  $isBeingDragged?: boolean;
}>`
  padding-left: ${({ $isNested }) => $isNested ? "16px" : "0"};
  align-items: start;

  .drag-handle {
    opacity: ${({ $isBeingDragged }) => $isBeingDragged ? 1 : 0};
    font-size: 16px;
    margin-left: 4px;
    color: ${({ $isBeingDragged }) => $isBeingDragged ? "#fff" : "#888"};
    filter: ${({ $isBeingDragged }) =>
      $isBeingDragged ? "drop-shadow(0 0 3px #fff)" : "none"};
    transition: opacity 0.15s, color 0.15s, filter 0.15s;
    user-select: none;
  }

  .shortcut-label {
    filter: ${({ $isBeingDragged }) =>
      $isBeingDragged
        ? "drop-shadow(0 0 2px #fffd)"
        : "drop-shadow(0 0 2px #fff6)"};
  }

  &.hover .alt-button {
    --icon-button-opacity: 0.5;
  }

  ${({ $isDraggable, $enableHover }) =>
    $isDraggable &&
    $enableHover &&
    `
    &.hover .drag-handle {
      opacity: 0.5;
    }

    &.hover .drag-handle.hover {
      opacity: 1;
      color: #fff;
      filter: drop-shadow(0 0 3px #fff);
    }

    &.hover .shortcut-label {
      filter: drop-shadow(0 0 2px #fffd);
    }
  `};
`;

const SmallCommand = styled(Command)`
  width: 28.8px;
  height: 28.8px;
  min-width: 28.8px;
  min-height: 28.8px;
  border-width: 2px;
  flex-shrink: 0;
`;

const LabelContainer = styled.span<{ $isDraggable?: boolean }>`
  flex: 1;
  user-select: ${({ $isDraggable }) => $isDraggable ? "none" : "auto"};
  cursor: ${({ $isDraggable }) => $isDraggable ? "grab" : "auto"};
`;

const ShortcutLabel = styled.span.attrs({ className: "shortcut-label" })`
  filter: drop-shadow(0 0 2px #fff6);
`;

type ShortcutRowProps = {
  actionKey: string;
  shortcut: string[];
  fullKey: string;
  isNested?: boolean;
  section: string;
  onSetBinding: (key: string, binding: string[]) => void;
  conflict?: ConflictInfo;
  isInMenu?: string | null;
  draggable?: boolean;
  draggedActionKey?: string | null;
  altBindings?: { key: string; binding: string[] }[];
  allAltKeys?: string[];
  tooltip?: string;
};

const AltButton = styled(IconButton).attrs({ className: "alt-button" })`
  --icon-button-opacity: 0;
  font-size: 16px;
`;

export const ShortcutRow = memo(({
  actionKey,
  shortcut,
  fullKey,
  isNested = false,
  section,
  onSetBinding,
  conflict,
  isInMenu,
  draggable = false,
  draggedActionKey = null,
  altBindings = [],
  allAltKeys = [],
  tooltip,
}: ShortcutRowProps) => {
  const { tooltipContainerProps, tooltip: tooltipPortal } = useTooltip<
    HTMLSpanElement
  >(tooltip);
  const primaryIsDefault = isDefaultBinding(
    section,
    fullKey,
    shortcut,
    defaultBindings,
  );

  // Check if any preset alt bindings are missing
  const presetAlts = getPresetAltDefaults(section, fullKey);
  const missingPresetAlts = presetAlts.filter(
    (pa) =>
      !altBindings.some((ab) =>
        ab.key === pa.key || bindingsEqual(ab.binding, pa.binding)
      ),
  );
  const isDefault = primaryIsDefault && missingPresetAlts.length === 0;

  const isBackAction = fullKey === "back" || fullKey.startsWith("menu-back-");
  const isDraggable = draggable && !isBackAction;

  // Compute hover behavior from passed-in drag state
  const isBeingDragged = draggedActionKey === fullKey;
  // Enable hover if not dragging anything OR if this row is being dragged
  const enableHover = !draggedActionKey || isBeingDragged;

  const onClick = useCallback(() => {
    if (getDragData()) return;
    startDrag({
      actionKey: fullKey,
      section,
      fromMenu: isInMenu ?? null,
    });
  }, []);

  const icon = getActionIcon(fullKey, section);
  const baseKey = getBaseKey(fullKey);
  const canDeletePrimary = altBindings.length > 0;

  const handleAddAlt = useCallback(() => {
    const nextIndex = allAltKeys.length > 0
      ? Math.max(
        ...allAltKeys.map((k) => getAltIndex(k)),
      ) + 1
      : 1;
    onSetBinding(makeAltKey(baseKey, nextIndex), []);
  }, [baseKey, allAltKeys, onSetBinding]);

  const handleRemoveBinding = useCallback((key: string) => {
    if (isAltKey(key)) {
      onSetBinding(key, []);
    } else if (altBindings.length > 0) {
      const firstAlt = altBindings[0];
      onSetBinding(key, firstAlt.binding);
      onSetBinding(firstAlt.key, []);
    }
  }, [altBindings, onSetBinding]);

  return (
    <VStack style={{ gap: "4px" }} data-testid="shortcut-row">
      <ShortcutRowContainer
        $isNested={isNested}
        $isDraggable={isDraggable}
        $enableHover={enableHover}
        $isBeingDragged={isBeingDragged}
      >
        {icon && (
          <SmallCommand
            name=""
            icon={icon}
            accentColor={colors[0]}
            hideTooltip
          />
        )}
        <LabelContainer
          $isDraggable={isDraggable}
          onClick={onClick}
          {...tooltipContainerProps}
        >
          <ShortcutLabel>
            {getActionDisplayName(actionKey, section)}
          </ShortcutLabel>
          {isDraggable && <span className="drag-handle">⋮⋮</span>}
        </LabelContainer>
        {tooltipPortal}
        <AltButton type="button" onClick={handleAddAlt}>+</AltButton>
        {canDeletePrimary && (
          <AltButton
            type="button"
            onClick={() => handleRemoveBinding(fullKey)}
          >
            🗑
          </AltButton>
        )}
        <ShortcutInputField
          binding={shortcut}
          defaultBinding={getEffectiveDefault(section, fullKey)}
          isDefault={isDefault}
          onSetBinding={(binding) => {
            if (!bindingsEqual(shortcut, binding)) {
              onSetBinding(fullKey, binding);
            }
            for (const pa of missingPresetAlts) {
              onSetBinding(pa.key, pa.binding);
            }
          }}
        />
      </ShortcutRowContainer>
      {altBindings.map((alt) => {
        const altDefault = getEffectiveDefault(section, alt.key);
        const altIsDefault = isDefaultBinding(
          section,
          alt.key,
          alt.binding,
          defaultBindings,
        );
        return (
          <ShortcutRowContainer key={alt.key} $isNested={isNested}>
            <span style={{ flex: 1 }} />
            <AltButton type="button" onClick={handleAddAlt}>+</AltButton>
            <AltButton
              type="button"
              onClick={() => handleRemoveBinding(alt.key)}
            >
              🗑
            </AltButton>
            <ShortcutInputField
              binding={alt.binding}
              defaultBinding={altDefault}
              isDefault={altIsDefault}
              onSetBinding={(binding) => onSetBinding(alt.key, binding)}
            />
          </ShortcutRowContainer>
        );
      })}
      {conflict && <ConflictWarning conflict={conflict} section={section} />}
    </VStack>
  );
});

ShortcutRow.displayName = "ShortcutRow";
