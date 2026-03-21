import { styled } from "styled-components";
import { HStack } from "@/components/layout/Layout.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { keyboard } from "../../../../controls/keyboardHandlers.ts";
import {
  formatShortcut,
  formatShortcutVerbose,
} from "@/util/formatShortcut.ts";
import { ShortcutInput } from "./styles.ts";
import { useTooltip } from "@/hooks/useTooltip.tsx";

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
}: ShortcutInputFieldProps) => {
  const verbose = formatShortcutVerbose(binding);
  const display = formatShortcut(binding);
  const { tooltipContainerProps, tooltip } = useTooltip<HTMLInputElement>(
    verbose !== display ? verbose : undefined,
  );

  return (
    <ShortcutInputContainer>
      <ShortcutInput
        value={display}
        onChange={() => {}}
        onKeyDown={(e) => {
          onSetBinding(
            Array.from(new Set([...Object.keys(keyboard), e.code])),
          );
          e.preventDefault();
        }}
        {...tooltipContainerProps}
      />
      {tooltip}
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
};
