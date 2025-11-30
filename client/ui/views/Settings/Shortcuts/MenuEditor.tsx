import { useState } from "react";
import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { Button } from "@/components/forms/Button.tsx";
import type { MenuConfig } from "@/vars/menus.ts";
import { svgs } from "../../../../systems/three.ts";

const IconPreview = styled.div`
  width: 64px;
  height: 64px;
  border: 4px outset ${({ theme }) => theme.colors.body};
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.shadow};
  filter: brightness(80%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &.hover {
    border-style: inset;
  }

  svg {
    width: 48px;
    height: 48px;
  }
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

const IconOption = styled.div<{ $selected: boolean }>`
  width: 48px;
  height: 48px;
  border: 3px outset ${({ theme }) => theme.colors.body};
  overflow: hidden;
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.shadow};
  filter: ${({ $selected }) =>
    $selected ? "brightness(100%)" : "brightness(80%)"};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &.hover {
    border-style: inset;
  }

  svg {
    width: 36px;
    height: 36px;
  }
`;

type MenuEditorProps = {
  menuForm: MenuConfig;
  onUpdateForm: (updates: Partial<MenuConfig>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export const MenuEditor = ({
  menuForm,
  onUpdateForm,
  onSave,
  onCancel,
  onDelete,
}: MenuEditorProps) => {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconKeys = Object.keys(svgs);

  return (
    <VStack>
      <HStack style={{ gap: "8px" }}>
        <IconPreview
          onClick={() => setShowIconPicker(!showIconPicker)}
          title="Click to change icon"
        >
          {menuForm.icon && svgs[menuForm.icon] && (
            <div dangerouslySetInnerHTML={{ __html: svgs[menuForm.icon] }} />
          )}
        </IconPreview>
        <VStack style={{ flex: 1, gap: "8px" }}>
          <Input
            value={menuForm.name || ""}
            onChange={(e) => onUpdateForm({ name: e.target.value })}
            placeholder="Menu name"
          />
          <Input
            value={menuForm.description || ""}
            onChange={(e) => onUpdateForm({ description: e.target.value })}
            placeholder="Description"
          />
        </VStack>
      </HStack>

      {showIconPicker && (
        <IconGrid>
          <IconOption
            $selected={!menuForm.icon}
            onClick={() => {
              onUpdateForm({ icon: undefined });
              setShowIconPicker(false);
            }}
            title="No icon"
          >
            ✕
          </IconOption>
          {iconKeys.map((key) => (
            <IconOption
              key={key}
              $selected={menuForm.icon === key}
              onClick={() => {
                onUpdateForm({ icon: key });
                setShowIconPicker(false);
              }}
              title={key}
            >
              <div dangerouslySetInnerHTML={{ __html: svgs[key] }} />
            </IconOption>
          ))}
        </IconGrid>
      )}

      <HStack>
        <Button type="button" onClick={onSave}>
          Save
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onDelete}>
          Delete
        </Button>
      </HStack>
    </VStack>
  );
};
