import { styled } from "styled-components";
import { HStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { keyboard } from "../../../../controls.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import { ShortcutInput } from "./styles.ts";

const ShortcutInputContainer = styled(HStack)`
  align-items: center;
`;

type ShortcutInputFieldProps = {
  binding: string[];
  defaultBinding: string[];
  isDefault: boolean;
  onSetBinding: (binding: string[]) => void;
  ariaLabel?: string;
};

export const ShortcutInputField = ({
  binding,
  defaultBinding,
  isDefault,
  onSetBinding,
  ariaLabel = "Reset hotkey",
}: ShortcutInputFieldProps) => (
  <ShortcutInputContainer>
    <ShortcutInput
      value={formatShortcut(binding)}
      onChange={() => {}}
      onKeyDown={(e) => {
        onSetBinding(
          Array.from(new Set([...Object.keys(keyboard), e.code])),
        );
        e.preventDefault();
      }}
    />
    <Button
      type="button"
      onClick={() => onSetBinding(defaultBinding)}
      aria-label={ariaLabel}
      disabled={isDefault}
    >
      ↺
    </Button>
  </ShortcutInputContainer>
);
