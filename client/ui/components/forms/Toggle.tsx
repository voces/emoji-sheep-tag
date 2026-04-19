import { styled } from "styled-components";

const ToggleLabel = styled.label<{ $disabled?: boolean; $dimmed?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  user-select: none;
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
  opacity: ${({ $disabled, $dimmed }) => $disabled ? 0.45 : $dimmed ? 0.5 : 1};
`;

const ToggleBox = styled.input`
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid ${({ theme }) => theme.border.hi};
  border-radius: ${({ theme }) => theme.radius.xs};
  background: ${({ theme }) => theme.surface[2]};
  display: grid;
  place-items: center;
  margin: 0;
  cursor: inherit;
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  flex-shrink: 0;

  &:checked {
    background: ${({ theme }) => theme.accent.DEFAULT};
    border-color: ${({ theme }) => theme.accent.DEFAULT};
  }

  &:checked::after {
    content: "";
    width: 9px;
    height: 9px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path fill='none' stroke='%23152030' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M1.5 5.2 L4 7.5 L8.5 2.5'/></svg>");
    background-size: contain;
  }
`;

export const Toggle = ({
  checked,
  onChange,
  disabled,
  isDefault,
  id,
  title,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isDefault?: boolean;
  id?: string;
  title?: string;
  children?: React.ReactNode;
}) => (
  <ToggleLabel $disabled={disabled} $dimmed={isDefault} title={title}>
    <ToggleBox
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      disabled={disabled}
      id={id}
    />
    {children}
  </ToggleLabel>
);
