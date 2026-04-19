import { memo, useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/forms/Button.tsx";
import { IconButton } from "@/components/forms/IconButton.tsx";
import { defaultMenus, isDefaultMenu, type MenuConfig } from "@/vars/menus.ts";
import {
  bindingsEqual,
  type ConflictInfo,
  getBaseKey,
  getEffectiveDefault,
  isAltKey,
} from "@/util/shortcutUtils.ts";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { getMenuActionInfo } from "./menuActionHelpers.ts";
import { ShortcutInputField } from "./ShortcutInputField.tsx";
import { ConflictWarning } from "./ConflictWarning.tsx";
import { registerDropTarget } from "./useDragState.ts";
import { Command } from "@/components/game/Command.tsx";
import { colors } from "@/shared/data.ts";
import { svgs } from "../../../../systems/models.ts";

const MenuActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 4px;
  min-height: 24px;
  border-left: 1px solid ${({ theme }) => theme.border.soft};
  margin-left: 14px;
`;

const SmallCommand = styled(Command)`
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  border-width: 1.5px;
  flex-shrink: 0;
  cursor: pointer;
`;

const IconPickerPanel = styled.div`
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 6px;
  padding: ${({ theme }) => theme.space[3]};
  max-height: 300px;
  overflow-y: auto;
  margin-left: 36px;
`;

const IconOption = styled(Command)<{ $selected: boolean }>`
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-width: 2px;
  border-color: ${({ $selected, theme }) =>
    $selected ? theme.accent.DEFAULT : "transparent"};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  transition: transform ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    transform: scale(1.1);
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const MenuHeaderRow = styled.div<{ $suppressHover?: boolean }>`
  display: grid;
  grid-template-columns: 26px 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};

  ${({ $suppressHover, theme }) =>
    !$suppressHover &&
    `
    &.hover {
      background: ${theme.surface[2]};
    }
  `};
`;

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ActionGroup = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
`;

const MenuModifiedTag = styled.span`
  padding: 0 5px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  color: ${({ theme }) => theme.accent.hi};
  background: ${({ theme }) => theme.accent.bg};
  line-height: 1.6;
`;

const MenuNameContainer = styled.span`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  cursor: pointer;
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.hi};
`;

const MenuNameInput = styled.input`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 4px 8px;
  margin: 0;
  font-size: ${({ theme }) => theme.text.sm};
  line-height: normal;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.accent.bg};
  }
`;

const ActionButton = styled(IconButton)`
  --icon-button-opacity: 0.35;
  min-width: 24px;
  min-height: 24px;
  padding: 4px;
`;

const ConfirmRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.danger.bg};
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.hi};
`;

const ConfirmLabel = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.danger.DEFAULT};
  font-weight: 500;
`;

const ConfirmButton = styled(Button)`
  min-height: 24px;
  padding: 2px 10px;
  font-size: ${({ theme }) => theme.text.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};

  &.hover:not([disabled]) {
    border-color: ${({ theme }) => theme.border.hi};
  }
`;

const DangerConfirmButton = styled(ConfirmButton)`
  color: ${({ theme }) => theme.danger.DEFAULT};
  border-color: ${({ theme }) => theme.danger.DEFAULT};

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.danger.bg};
    border-color: ${({ theme }) => theme.danger.DEFAULT};
  }
`;

type MenuManagement = {
  deletion: {
    menuToDelete: string | null;
    deleteMenu: (menuId: string) => void;
    confirm: () => void;
    cancel: () => void;
  };
  actions: {
    add: (menuId: string, actionKey: string) => void;
    remove: (menuId: string, actionKey: string) => void;
    updateIcon: (menuId: string, icon: string | undefined) => void;
    updateName: (menuId: string, name: string) => void;
  };
};

type MenuDisplayProps = {
  menu: MenuConfig;
  section: string;
  shortcuts: Record<string, string[]>;
  menuConflicts: Map<string, ConflictInfo>;
  menuBindingConflict?: ConflictInfo;
  menuManagement: MenuManagement;
  onSetBinding: (key: string, binding: string[]) => void;
  draggedActionKey?: string | null;
  matchingKeys?: Set<string> | null;
};

const menuActionsEqual = (a: MenuConfig["actions"], b: MenuConfig["actions"]) =>
  a.length === b.length && a.every((action, i) => {
    const other = b[i];
    if ("type" in action && "type" in other) {
      if (action.type !== other.type) return false;
      if (action.type === "purchase" && other.type === "purchase") {
        return action.itemId === other.itemId;
      }
      if (action.type === "action" && other.type === "action") {
        return action.actionKey === other.actionKey;
      }
    }
    return action === other;
  });

const propsAreEqual = (
  prev: MenuDisplayProps,
  next: MenuDisplayProps,
): boolean =>
  prev.menu.id === next.menu.id &&
  prev.menu.name === next.menu.name &&
  menuActionsEqual(prev.menu.actions, next.menu.actions) &&
  prev.section === next.section &&
  prev.menuBindingConflict === next.menuBindingConflict &&
  prev.onSetBinding === next.onSetBinding &&
  prev.draggedActionKey === next.draggedActionKey &&
  prev.menuManagement.deletion.menuToDelete ===
    next.menuManagement.deletion.menuToDelete &&
  prev.menuManagement.actions === next.menuManagement.actions &&
  prev.menuConflicts === next.menuConflicts;

export const MenuDisplay = memo(({
  menu,
  section,
  shortcuts,
  menuConflicts,
  menuBindingConflict,
  menuManagement,
  onSetBinding,
  draggedActionKey = null,
  matchingKeys,
}: MenuDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(menu.name);

  // Disable hover effects while dragging
  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== menu.name) {
      menuManagement.actions.updateName(menu.id, tempName);
    }
    setEditingName(false);
    setTempName(menu.name);
  };

  const handleNameCancel = () => {
    setEditingName(false);
    setTempName(menu.name);
  };

  // Register as drop target
  useEffect(() => {
    if (!containerRef.current) return;
    return registerDropTarget(
      `menu-${menu.id}`,
      containerRef.current,
      (data) => {
        if (data.section !== section) return;
        // If dropping on the menu it came from, do nothing (just cancel)
        if (data.fromMenu === menu.id) return;
        // Add to this menu
        menuManagement.actions.add(menu.id, data.actionKey);
      },
    );
  }, [menu.id, section, menuManagement.actions]);

  // Menu binding key and default binding
  const menuBindingKey = `menu-${menu.id}`;
  const currentBinding = shortcuts[menuBindingKey] ?? menu.binding ?? [];
  const defaultBinding = menu.binding ?? [];
  const hasDefaultBinding = menu.binding !== undefined &&
    menu.binding.length > 0;

  // Find the default menu to compare name
  const defaultMenu = defaultMenus.find((m) => m.id === menu.id);
  const hasNameOverride = defaultMenu && menu.name !== defaultMenu.name;

  // Check if current binding matches default
  // If menu has no default binding, reset button should be disabled (unless name is overridden)
  const hasBindingOverride = shortcuts[menuBindingKey] !== undefined;
  const isBindingDefault = !hasDefaultBinding || !hasBindingOverride ||
    bindingsEqual(currentBinding, defaultBinding);
  const isDefault = isBindingDefault && !hasNameOverride;

  // Handle reset - resets both binding and name
  const handleReset = (binding: string[]) => {
    onSetBinding(menuBindingKey, binding);
    if (hasNameOverride && defaultMenu) {
      menuManagement.actions.updateName(menu.id, defaultMenu.name);
    }
  };

  const isConfirmingDelete = menuManagement.deletion.menuToDelete === menu.id;

  return (
    <MenuWrapper key={`menu-${menu.id}`}>
      {isConfirmingDelete
        ? (
          <ConfirmRow>
            <ConfirmLabel>Delete "{menu.name}"?</ConfirmLabel>
            <ActionGroup>
              <DangerConfirmButton onClick={menuManagement.deletion.confirm}>
                Delete
              </DangerConfirmButton>
              <ConfirmButton onClick={menuManagement.deletion.cancel}>
                Cancel
              </ConfirmButton>
            </ActionGroup>
          </ConfirmRow>
        )
        : (
          <MenuHeaderRow $suppressHover={!!draggedActionKey}>
            <SmallCommand
              name=""
              icon={menu.icon ?? "shop"}
              accentColor={colors[0]}
              hideTooltip
              role="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
            />
            {editingName
              ? (
                <MenuNameInput
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSubmit();
                    if (e.key === "Escape") handleNameCancel();
                  }}
                  autoFocus
                />
              )
              : (
                <MenuNameContainer
                  onClick={() => setEditingName(true)}
                >
                  {menu.name}
                  <ActionButton as="span" title="Rename">
                    <Pencil size={14} />
                  </ActionButton>
                  {!isDefaultMenu(menu) && (
                    <MenuModifiedTag>modified</MenuModifiedTag>
                  )}
                </MenuNameContainer>
              )}

            <ActionGroup>
              <ActionButton
                onClick={() => menuManagement.deletion.deleteMenu(menu.id)}
                title="Delete menu"
              >
                <Trash2 size={14} />
              </ActionButton>
            </ActionGroup>

            <ShortcutInputField
              binding={currentBinding}
              defaultBinding={defaultBinding}
              isDefault={isDefault}
              onSetBinding={handleReset}
              ariaLabel="Reset menu hotkey"
            />
          </MenuHeaderRow>
        )}
      {menuBindingConflict && (
        <ConflictWarning conflict={menuBindingConflict} section={section} />
      )}
      {showIconPicker && (
        <IconPickerPanel>
          {Object.keys(svgs).map((key) => (
            <IconOption
              key={key}
              $selected={menu.icon === key}
              onClick={() => {
                menuManagement.actions.updateIcon(menu.id, key);
                setShowIconPicker(false);
              }}
              name=""
              icon={key}
              accentColor={colors[0]}
              hideTooltip
            />
          ))}
        </IconPickerPanel>
      )}

      <MenuActionsContainer ref={containerRef}>
        {menu.actions
          .toSorted((a, b) => {
            const aInfo = getMenuActionInfo(a, menu.id);
            const bInfo = getMenuActionInfo(b, menu.id);
            return aInfo.displayName.localeCompare(bInfo.displayName);
          })
          .filter((action) => {
            if (!matchingKeys) return true;
            const info = getMenuActionInfo(action, menu.id);
            return matchingKeys.has(info.actionKey);
          })
          .map((action) => {
            const actionInfo = getMenuActionInfo(action, menu.id);
            const binding = shortcuts[actionInfo.actionKey] ??
              actionInfo.defaultBinding;
            const conflict = menuConflicts.get(actionInfo.actionKey);

            const altBindings = Object.entries(shortcuts)
              .filter(([key, b]) =>
                isAltKey(key) &&
                getBaseKey(key) === actionInfo.actionKey &&
                (b.length > 0 ||
                  getEffectiveDefault(section, key).length === 0)
              )
              .map(([key, b]) => ({ key, binding: b }));
            const allAltKeys = Object.keys(shortcuts)
              .filter((key) =>
                isAltKey(key) && getBaseKey(key) === actionInfo.actionKey
              );

            return (
              <ShortcutRow
                key={`menu-${menu.id}.${actionInfo.actionKey}`}
                actionKey={actionInfo.displayName}
                shortcut={binding}
                fullKey={actionInfo.actionKey}
                isNested
                section={section}
                onSetBinding={onSetBinding}
                conflict={conflict}
                isInMenu={menu.id}
                draggable
                draggedActionKey={draggedActionKey}
                altBindings={altBindings}
                allAltKeys={allAltKeys}
              />
            );
          })}
      </MenuActionsContainer>
    </MenuWrapper>
  );
}, propsAreEqual);

MenuDisplay.displayName = "MenuDisplay";
