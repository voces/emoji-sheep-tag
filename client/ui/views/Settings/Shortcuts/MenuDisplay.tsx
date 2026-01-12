import { memo, useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Dialog } from "@/components/layout/Dialog.tsx";
import { defaultMenus, type MenuConfig } from "@/vars/menus.ts";
import { bindingsEqual, type ConflictInfo } from "@/util/shortcutUtils.ts";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { getMenuActionInfo } from "./menuActionHelpers.ts";
import { ShortcutInputField } from "./ShortcutInputField.tsx";
import { ConflictWarning } from "./ConflictWarning.tsx";
import { registerDropTarget } from "./useDragState.ts";
import { Command } from "@/components/game/Command.tsx";
import { colors } from "@/shared/data.ts";
import { svgs } from "../../../../systems/three.ts";

const MenuActionsContainer = styled(VStack)`
  padding-left: 16px;
  min-height: 24px;
`;

const SmallCommand = styled(Command)`
  width: 28.8px;
  height: 28.8px;
  min-width: 28.8px;
  min-height: 28.8px;
  border-width: 2px;
  flex-shrink: 0;
  cursor: pointer;
`;

const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
  padding: 8px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
`;

const IconOption = styled(Command)<{ $selected: boolean }>`
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  border-width: 3px;
  filter: ${({ $selected }) =>
    $selected ? "brightness(100%)" : "brightness(80%)"};
`;

const MenuNameContainer = styled.span<{ $enableHover?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  .edit-icon {
    opacity: 0;
    font-size: 16px;
    transition: opacity 0.15s;
  }

  ${({ $enableHover }) =>
    $enableHover &&
    `
    &.hover .edit-icon {
      opacity: 0.7;
    }

    &.hover .menu-name {
      filter: drop-shadow(0 0 2px #fffd);
    }
  `};
`;

const MenuNameDisplay = styled.span.attrs({ className: "menu-name" })`
  filter: drop-shadow(0 0 2px #fff6);
`;

const MenuNameInput = styled.input`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.body};
  color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 4px;
  margin: 0;
  line-height: normal;
`;

const MenuHeaderRow = styled(HStack)<{ $enableHover?: boolean }>`
  align-items: center;

  ${({ $enableHover }) =>
    $enableHover &&
    `
    &.hover .delete-button {
      opacity: 1;
    }

    &.hover .delete-button.hover {
      filter: drop-shadow(0 0 3px #fff);
    }
  `};
`;

const DeleteButton = styled.button.attrs({ className: "delete-button" })`
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, filter 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  filter: drop-shadow(0 0 2px #fff6);
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
}: MenuDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(menu.name);

  // Disable hover effects while dragging
  const enableHover = !draggedActionKey;

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

  return (
    <VStack key={`menu-${menu.id}`}>
      <MenuHeaderRow $enableHover={enableHover}>
        <SmallCommand
          name=""
          icon={menu.icon ?? "shop"}
          accentColor={colors[0]}
          hideTooltip
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
              $enableHover={enableHover}
              onClick={() => setEditingName(true)}
            >
              <MenuNameDisplay>{menu.name}</MenuNameDisplay>
              <span className="edit-icon">✎</span>
            </MenuNameContainer>
          )}

        <DeleteButton
          onClick={() => menuManagement.deletion.deleteMenu(menu.id)}
          title="Delete menu"
        >
          🗑
        </DeleteButton>

        <ShortcutInputField
          binding={currentBinding}
          defaultBinding={defaultBinding}
          isDefault={isDefault}
          onSetBinding={handleReset}
          ariaLabel="Reset menu hotkey"
        />
      </MenuHeaderRow>
      {menuBindingConflict && (
        <ConflictWarning conflict={menuBindingConflict} section={section} />
      )}
      {showIconPicker && (
        <IconGrid>
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
        </IconGrid>
      )}

      <MenuActionsContainer ref={containerRef}>
        {menu.actions
          .toSorted((a, b) => {
            const aInfo = getMenuActionInfo(a, menu.id);
            const bInfo = getMenuActionInfo(b, menu.id);
            return aInfo.displayName.localeCompare(bInfo.displayName);
          })
          .map((action) => {
            const actionInfo = getMenuActionInfo(action, menu.id);
            const binding = shortcuts[actionInfo.actionKey] ??
              actionInfo.defaultBinding;
            const conflict = menuConflicts.get(actionInfo.actionKey);

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
              />
            );
          })}
      </MenuActionsContainer>

      {menuManagement.deletion.menuToDelete === menu.id && (
        <Dialog>
          <VStack>
            <div>Delete this menu?</div>
            <HStack>
              <Button onClick={menuManagement.deletion.confirm}>
                Delete
              </Button>
              <Button onClick={menuManagement.deletion.cancel}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        </Dialog>
      )}
    </VStack>
  );
}, propsAreEqual);

MenuDisplay.displayName = "MenuDisplay";
