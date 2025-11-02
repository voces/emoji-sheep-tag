import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import {
  type ConflictInfo,
  defaultBindings,
  getActionDisplayName,
  isDefaultBinding,
} from "@/util/shortcutUtils.ts";
import { ShortcutInputField } from "./ShortcutInputField.tsx";
import { ConflictWarning } from "./ConflictWarning.tsx";

const ShortcutRowContainer = styled(HStack)<{ $isNested?: boolean }>`
  padding-left: ${({ $isNested }) => $isNested ? "16px" : "0"};
`;

const ShortcutLabel = styled.p`
  flex: 1;
  flex-basis: 1;
`;

const ShortcutInputContainer = styled(HStack)`
  align-items: center;
`;

export type ShortcutRowProps = {
  actionKey: string;
  shortcut: string[];
  fullKey: string;
  isNested?: boolean;
  section: string;
  onSetBinding: (key: string, binding: string[]) => void;
  conflict?: ConflictInfo;
  editingMenuId?: string | null;
  isInMenu?: string | null; // Which menu this action is in, if any
  onAddToMenu?: (actionKey: string) => void;
  onRemoveFromMenu?: (actionKey: string) => void;
};

export const ShortcutRow = ({
  actionKey,
  shortcut,
  fullKey,
  isNested = false,
  section,
  onSetBinding,
  conflict,
  editingMenuId,
  isInMenu,
  onAddToMenu,
  onRemoveFromMenu,
}: ShortcutRowProps) => {
  const isDefault = isDefaultBinding(
    section,
    fullKey,
    shortcut,
    defaultBindings,
  );

  const isBackAction = fullKey === "back" || fullKey.startsWith("menu-back-");
  const isEditingMenu = editingMenuId !== null && editingMenuId !== undefined;
  const showMenuButtons = isEditingMenu && !isBackAction;

  return (
    <VStack style={{ gap: "4px" }} data-testid="shortcut-row">
      <ShortcutRowContainer $isNested={isNested}>
        <ShortcutLabel>
          {getActionDisplayName(actionKey, section)}
        </ShortcutLabel>
        {showMenuButtons
          ? (
            <ShortcutInputContainer>
              {isInMenu === editingMenuId
                ? (
                  <Button
                    type="button"
                    onClick={() => onRemoveFromMenu?.(fullKey)}
                  >
                    Remove
                  </Button>
                )
                : (
                  <Button
                    type="button"
                    onClick={() => onAddToMenu?.(fullKey)}
                    aria-label={`Add ${
                      getActionDisplayName(actionKey, section)
                    }`}
                  >
                    Add
                  </Button>
                )}
            </ShortcutInputContainer>
          )
          : (
            <ShortcutInputField
              binding={shortcut}
              defaultBinding={defaultBindings[section]?.[fullKey] ?? []}
              isDefault={isDefault}
              onSetBinding={(binding) => onSetBinding(fullKey, binding)}
            />
          )}
      </ShortcutRowContainer>
      {conflict && <ConflictWarning conflict={conflict} section={section} />}
    </VStack>
  );
};
