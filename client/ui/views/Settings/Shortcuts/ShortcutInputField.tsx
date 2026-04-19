import { styled } from "styled-components";
import { RotateCcw } from "lucide-react";
import { keyboard } from "../../../../controls/keyboardHandlers.ts";
import {
  formatShortcut,
  formatShortcutVerbose,
} from "@/util/formatShortcut.ts";
import { useTooltip } from "@/hooks/useTooltip.tsx";

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input<{ $changed: boolean }>`
  width: 100%;
  max-width: 110px;
  min-height: 28px;
  padding: 5px 26px 5px 8px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.sm};
  letter-spacing: 0.02em;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.ink.hi};
  outline: none;
  opacity: ${({ $changed }) => ($changed ? 1 : 0.5)};
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    opacity ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.hi};
    opacity: 1;
  }

  &:focus {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.accent.bg};
    opacity: 1;
  }
`;

const ResetButton = styled.button`
  position: absolute;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: ${({ theme }) => theme.radius.xs};
  border: none;
  background: ${({ theme }) => theme.surface[3]};
  color: ${({ theme }) => theme.ink.lo};
  cursor: pointer;
  padding: 0;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
  }
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
    <InputWrapper>
      <StyledInput
        $changed={!isDefault}
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
      {!isDefault && (
        <ResetButton
          type="button"
          onClick={() => onSetBinding(defaultBinding)}
          aria-label={ariaLabel}
          title="Reset to default"
        >
          <RotateCcw size={12} />
        </ResetButton>
      )}
    </InputWrapper>
  );
};
