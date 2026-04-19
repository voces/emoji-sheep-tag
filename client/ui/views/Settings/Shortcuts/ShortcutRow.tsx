import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import {
  ArrowRightLeft,
  Ban,
  Crosshair,
  GripVertical,
  Keyboard,
  ListOrdered,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Plus,
  Search,
  Trash2,
  ZoomIn,
} from "lucide-react";
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

const BindRow = styled.div<{
  $isNested?: boolean;
  $isDraggable?: boolean;
  $enableHover?: boolean;
  $isBeingDragged?: boolean;
}>`
  display: grid;
  grid-template-columns: 26px 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 6px 10px;
  padding-left: ${({ $isNested }) => $isNested ? "6px" : "10px"};
  border-radius: ${({ theme }) => theme.radius.sm};
  transition: opacity ${({ theme }) => theme.motion.fast}, box-shadow ${(
    { theme },
  ) => theme.motion.fast};

  .drag-handle {
    opacity: ${({ $isBeingDragged }) => $isBeingDragged ? 1 : 0.25};
    color: ${({ $isBeingDragged, theme }) =>
      $isBeingDragged ? theme.ink.hi : theme.ink.lo};
    transition: opacity ${({ theme }) => theme.motion.fast}, color ${(
      { theme },
    ) => theme.motion.fast};
    user-select: none;
    display: inline-flex;
    align-items: center;
  }

  ${({ $isBeingDragged, theme }) =>
    $isBeingDragged &&
    `
    opacity: 0.6;
    border: 1px solid ${theme.accent.DEFAULT};
    box-shadow: ${theme.shadow.md};
    background: ${theme.surface[2]};
    z-index: 10;
    position: relative;
  `} ${({ $enableHover, theme }) =>
    $enableHover !== false &&
    `
    &.hover {
      background: ${theme.surface[2]};
    }
  `}
    ${({ $isDraggable, $enableHover, theme }) =>
      $isDraggable &&
      $enableHover &&
      `
    &.hover .drag-handle {
      opacity: 0.5;
    }

    &.hover .drag-handle.hover {
      opacity: 1;
      color: ${theme.ink.hi};
    }
  `};
`;

const SmallCommand = styled(Command)`
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  border-width: 1.5px;
  flex-shrink: 0;
`;

const IconCell = styled.span`
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  color: ${({ theme }) => theme.ink.lo};
`;

const LabelCell = styled.span<{ $isDraggable?: boolean }>`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.hi};
  user-select: ${({ $isDraggable }) => $isDraggable ? "none" : "auto"};
  cursor: ${({ $isDraggable }) => $isDraggable ? "grab" : "auto"};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const AltBindRow = styled.div`
  display: grid;
  grid-template-columns: 26px 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const RowGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ActionGroup = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
`;

const ActionButton = styled(IconButton)`
  --icon-button-opacity: 0.35;
  min-width: 24px;
  min-height: 24px;
  padding: 4px;
`;

const ICON_SIZE = 16;

const MISC_ICONS: Record<string, React.ReactNode> = {
  openCommandPalette: <Search size={ICON_SIZE} />,
  openChat: <MessageSquare size={ICON_SIZE} />,
  cancel: <Ban size={ICON_SIZE} />,
  queueModifier: <ListOrdered size={ICON_SIZE} />,
  addToSelectionModifier: <MousePointerClick size={ICON_SIZE} />,
  ping: <MapPin size={ICON_SIZE} />,
  jumpToPing: <Crosshair size={ICON_SIZE} />,
  applyZoom: <ZoomIn size={ICON_SIZE} />,
  toggleScoreboard: <ArrowRightLeft size={ICON_SIZE} />,
  cycleSelection: <ArrowRightLeft size={ICON_SIZE} />,
};

const GroupDigit = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.lo};
`;

const CONTROL_GROUP_ICONS: Record<string, React.ReactNode> = {
  assignModifier: <Keyboard size={ICON_SIZE} />,
  group1: <GroupDigit>1</GroupDigit>,
  group2: <GroupDigit>2</GroupDigit>,
  group3: <GroupDigit>3</GroupDigit>,
  group4: <GroupDigit>4</GroupDigit>,
  group5: <GroupDigit>5</GroupDigit>,
  group6: <GroupDigit>6</GroupDigit>,
  group7: <GroupDigit>7</GroupDigit>,
  group8: <GroupDigit>8</GroupDigit>,
  group9: <GroupDigit>9</GroupDigit>,
  group0: <GroupDigit>0</GroupDigit>,
};

const AddBindingButton = (
  { onClick, label }: { onClick: () => void; label: string },
) => {
  const { tooltipContainerProps, tooltip: tip } = useTooltip<HTMLButtonElement>(
    label,
  );
  return (
    <>
      <ActionButton
        type="button"
        ref={tooltipContainerProps.ref}
        onMouseEnter={tooltipContainerProps.onMouseEnter}
        onMouseLeave={tooltipContainerProps.onMouseLeave}
        onClick={onClick}
        aria-label={label}
      >
        <Plus size={14} />
      </ActionButton>
      {tip}
    </>
  );
};

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
  const { t } = useTranslation();
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

  const renderIcon = () => {
    if (icon) {
      return (
        <SmallCommand
          name=""
          icon={icon}
          accentColor={colors[0]}
          hideTooltip
        />
      );
    }
    const lucideIcon = MISC_ICONS[actionKey] ?? CONTROL_GROUP_ICONS[actionKey];
    if (lucideIcon) return <IconCell>{lucideIcon}</IconCell>;
    if (actionKey.startsWith("slot-")) {
      return (
        <IconCell>
          <GroupDigit>{actionKey.substring(5)}</GroupDigit>
        </IconCell>
      );
    }
    return <IconCell />;
  };

  return (
    <RowGroup data-testid="shortcut-row">
      <BindRow
        $isNested={isNested}
        $isDraggable={isDraggable}
        $enableHover={enableHover}
        $isBeingDragged={isBeingDragged}
      >
        {renderIcon()}
        <LabelCell
          $isDraggable={isDraggable}
          onMouseDown={isDraggable ? onClick : undefined}
          {...tooltipContainerProps}
        >
          {getActionDisplayName(actionKey, section)}
          {isDraggable && (
            <span className="drag-handle">
              <GripVertical size={14} />
            </span>
          )}
        </LabelCell>
        {tooltipPortal}
        <ActionGroup>
          <AddBindingButton
            onClick={handleAddAlt}
            label={t("settings.addSecondaryBinding")}
          />
          {canDeletePrimary && (
            <ActionButton
              type="button"
              onClick={() => handleRemoveBinding(fullKey)}
              aria-label="Remove binding"
            >
              <Trash2 size={14} />
            </ActionButton>
          )}
        </ActionGroup>
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
      </BindRow>
      {altBindings.map((alt) => {
        const altDefault = getEffectiveDefault(section, alt.key);
        const altIsDefault = isDefaultBinding(
          section,
          alt.key,
          alt.binding,
          defaultBindings,
        );
        return (
          <AltBindRow key={alt.key}>
            <span />
            <span />
            <ActionGroup>
              <ActionButton
                type="button"
                onClick={handleAddAlt}
                aria-label="Add binding"
                title="Add secondary binding"
              >
                <Plus size={14} />
              </ActionButton>
              <ActionButton
                type="button"
                onClick={() => handleRemoveBinding(alt.key)}
                aria-label="Remove binding"
              >
                <Trash2 size={14} />
              </ActionButton>
            </ActionGroup>
            <ShortcutInputField
              binding={alt.binding}
              defaultBinding={altDefault}
              isDefault={altIsDefault}
              onSetBinding={(binding) => onSetBinding(alt.key, binding)}
            />
          </AltBindRow>
        );
      })}
      {conflict && <ConflictWarning conflict={conflict} section={section} />}
    </RowGroup>
  );
});

ShortcutRow.displayName = "ShortcutRow";
