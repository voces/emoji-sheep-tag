import React from "react";
import { styled } from "styled-components";
import { CheckedIcon } from "../icons/CheckedIcon.tsx";
import { UncheckedIcon } from "../icons/UncheckedIcon.tsx";

const CheckboxContainer = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ $disabled }) => $disabled ? "not-allowed" : "pointer"};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

const CheckboxIconContainer = styled.div<
  { $disabled?: boolean; $size: number }
>`
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${({ theme }) => theme.motion.med} ${({ theme }) =>
    theme.motion.easeOut};
  color: ${({ theme }) => theme.ink.hi};
  width: ${({ $size }) => `${$size}px`};
  height: ${({ $size }) => `${$size}px`};

  svg .box {
    fill: ${({ theme }) => theme.surface[2]};
  }

  &.hover {
    svg .box {
      fill: ${({ theme, $disabled }) => $disabled ? "" : theme.surface[3]};
    }
  }
`;

type CheckboxProps = {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  size?: number;
  color?: string;
};

export const Checkbox = ({
  checked,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  size = 28.8,
  color,
}: CheckboxProps) => (
  <CheckboxContainer $disabled={disabled}>
    <HiddenInput
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
    />
    <CheckboxIconContainer $size={size}>
      {checked
        ? <CheckedIcon size={size} color={color} />
        : <UncheckedIcon size={size} />}
    </CheckboxIconContainer>
  </CheckboxContainer>
);
