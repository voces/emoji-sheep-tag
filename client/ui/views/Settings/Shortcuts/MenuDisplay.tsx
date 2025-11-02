import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Dialog } from "@/components/layout/Dialog.tsx";
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
  editing: {
    form: MenuConfig | null;
    start: (menu: MenuConfig) => void;
    save: () => void;
    cancel: () => void;
    updateForm: (updates: Partial<MenuConfig>) => void;
  };
  deletion: {
    menuToDelete: string | null;
    deleteMenu: (menuId: string) => void;
    confirm: () => void;
    cancel: () => void;
  };
  actions: {
    add: (menuId: string, actionKey: string) => void;
    remove: (menuId: string, actionKey: string) => void;
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
  const isEditing = menuManagement.editing.form?.id === menu.id;

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
              onClick={() => menuManagement.editing.start(menu)}
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

      {menuManagement.editing.form && isEditing && (
        <MenuEditor
          menuForm={menuManagement.editing.form}
          onUpdateForm={menuManagement.editing.updateForm}
          onSave={menuManagement.editing.save}
          onCancel={menuManagement.editing.cancel}
          onDelete={() => menuManagement.deletion.deleteMenu(menu.id)}
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
                editingMenuId={menuManagement.editing.form?.id ?? null}
                isInMenu={menu.id}
                onAddToMenu={(actionKey) =>
                  menuManagement.editing.form?.id &&
                  menuManagement.actions.add(
                    menuManagement.editing.form.id,
                    actionKey,
                  )}
                onRemoveFromMenu={(actionKey) =>
                  menuManagement.editing.form?.id &&
                  menuManagement.actions.remove(
                    menuManagement.editing.form.id,
                    actionKey,
                  )}
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
};
