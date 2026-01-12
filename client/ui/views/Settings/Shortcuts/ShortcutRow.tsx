import { memo, useCallback, useRef } from "react";
import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import {
  type ConflictInfo,
  defaultBindings,
  getActionDisplayName,
  isDefaultBinding,
} from "@/util/shortcutUtils.ts";
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

  ${({ $isDraggable, $enableHover }) =>
    $isDraggable &&
    $enableHover &&
    `
    &.hover .drag-handle {
      opacity: 1;
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
};

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
}: ShortcutRowProps) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const isDefault = isDefaultBinding(
    section,
    fullKey,
    shortcut,
    defaultBindings,
  );

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
          ref={labelRef}
          $isDraggable={isDraggable}
          onClick={onClick}
        >
          <ShortcutLabel>
            {getActionDisplayName(actionKey, section)}
          </ShortcutLabel>
          {isDraggable && <span className="drag-handle">⋮⋮</span>}
        </LabelContainer>
        <ShortcutInputField
          binding={shortcut}
          defaultBinding={defaultBindings[section]?.[fullKey] ?? []}
          isDefault={isDefault}
          onSetBinding={(binding) => onSetBinding(fullKey, binding)}
        />
      </ShortcutRowContainer>
      {conflict && <ConflictWarning conflict={conflict} section={section} />}
    </VStack>
  );
});

ShortcutRow.displayName = "ShortcutRow";
