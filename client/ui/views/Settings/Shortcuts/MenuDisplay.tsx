import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import type { MenuConfig } from "@/vars/menus.ts";
import { bindingsEqual, type ConflictInfo } from "@/util/shortcutUtils.ts";
import { ShortcutRow } from "./ShortcutRow.tsx";
import { MenuEditor } from "./MenuEditor.tsx";
import { getMenuActionInfo } from "./menuActionHelpers.ts";
import { ShortcutInputField } from "./ShortcutInputField.tsx";
import { ConflictWarning } from "./ConflictWarning.tsx";

const MenuActionsContainer = styled(VStack)`
  padding-left: 16px;
`;

type MenuManagement = {
  editingMenuId: string | null;
  editMenuForm: MenuConfig | null;
  startEditMenu: (menu: MenuConfig) => void;
  saveEditMenu: () => void;
  cancelEditMenu: () => void;
  deleteMenu: (menuId: string) => void;
  addActionToMenu: (menuId: string, actionKey: string) => void;
  removeActionFromMenu: (menuId: string, actionKey: string) => void;
  updateEditMenuForm: (updates: Partial<MenuConfig>) => void;
  restoreDefaultMenu: (menuId: string) => void;
  getDeletedDefaultMenus: () => MenuConfig[];
};

type MenuDisplayProps = {
  menu: MenuConfig;
  section: string;
  shortcuts: Record<string, string[]>;
  menuConflicts: Map<string, ConflictInfo>;
  menuBindingConflict?: ConflictInfo;
  menuManagement: MenuManagement;
  onSetBinding: (key: string, binding: string[]) => void;
};

export const MenuDisplay = ({
  menu,
  section,
  shortcuts,
  menuConflicts,
  menuBindingConflict,
  menuManagement,
  onSetBinding,
}: MenuDisplayProps) => {
  const isEditing = menuManagement.editingMenuId === menu.id;

  // Menu binding key and default binding
  const menuBindingKey = `menu-${menu.id}`;
  const currentBinding = shortcuts[menuBindingKey] ?? menu.binding ?? [];
  const defaultBinding = menu.binding ?? [];
  const hasDefaultBinding = menu.binding !== undefined &&
    menu.binding.length > 0;

  // Check if current binding matches default
  // If menu has no default binding, reset button should be disabled
  const hasOverride = shortcuts[menuBindingKey] !== undefined;
  const isDefault = !hasDefaultBinding || !hasOverride ||
    bindingsEqual(currentBinding, defaultBinding);

  return (
    <VStack key={`menu-${menu.id}`}>
      {!isEditing && (
        <>
          <HStack>
            <div style={{ flex: 1 }}>{menu.name}</div>
            <Button
              type="button"
              onClick={() => menuManagement.startEditMenu(menu)}
            >
              Edit
            </Button>

            <ShortcutInputField
              binding={currentBinding}
              defaultBinding={defaultBinding}
              isDefault={isDefault}
              onSetBinding={(binding) => onSetBinding(menuBindingKey, binding)}
              ariaLabel="Reset menu hotkey"
            />
          </HStack>
          {menuBindingConflict && (
            <ConflictWarning conflict={menuBindingConflict} section={section} />
          )}
        </>
      )}

      {menuManagement.editMenuForm && isEditing && (
        <MenuEditor
          menuForm={menuManagement.editMenuForm}
          onUpdateForm={menuManagement.updateEditMenuForm}
          onSave={menuManagement.saveEditMenu}
          onCancel={menuManagement.cancelEditMenu}
          onDelete={() => menuManagement.deleteMenu(menu.id)}
        />
      )}

      <MenuActionsContainer>
        {menu.actions
          .filter((action) => {
            // Hide Back action when editing
            if (
              isEditing && "type" in action && action.type === "action" &&
              action.actionKey === "back"
            ) {
              return false;
            }
            return true;
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
                editingMenuId={menuManagement.editingMenuId}
                isInMenu={menu.id}
                onAddToMenu={(actionKey) =>
                  menuManagement.editingMenuId &&
                  menuManagement.addActionToMenu(
                    menuManagement.editingMenuId,
                    actionKey,
                  )}
                onRemoveFromMenu={(actionKey) =>
                  menuManagement.editingMenuId &&
                  menuManagement.removeActionFromMenu(
                    menuManagement.editingMenuId,
                    actionKey,
                  )}
              />
            );
          })}
      </MenuActionsContainer>
    </VStack>
  );
};
