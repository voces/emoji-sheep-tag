import { useEffect, useMemo, useRef, useState } from "react";
import { styled } from "styled-components";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  id?: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const SelectWrapper = styled.div`
  position: relative;
  width: 100%;
  text-align: left;
`;

const SelectButton = styled(Button)`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Chevron = styled.span`
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid ${({ theme }) => theme.colors.border};
  pointer-events: none;
`;

const SelectMenu = styled(Card)`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  max-height: 220px;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm};
  background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 10));
`;

// TODO: Add styling for aria-selected, maybe a checkbox?
const Option = styled.option`
  width: 100%;
  flex-shrink: 0;
  text-align: left;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.border};
  text-shadow: none;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.borderRadius.sm};

  &.hover {
    color: ${({ theme }) => theme.colors.body};
    background: ${({ theme }) => theme.colors.background};
    outline: none;
  }
`;

export const Select = ({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Select…",
  className,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestPointerLock = () => {
    try {
      if (
        document.body &&
        !document.pointerLockElement &&
        typeof document.body.requestPointerLock === "function"
      ) {
        document.body.requestPointerLock({ unadjustedMovement: true });
      }
    } catch { /* ignore */ }
  };

  const label = useMemo(
    () =>
      options.find((option) => option.value === value)?.label ?? placeholder,
    [options, value, placeholder],
  );

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (
        e.isTrusted || !wrapperRef.current || !open ||
        !(e.target instanceof HTMLElement) ||
        wrapperRef.current.contains(e.target)
      ) return;
      setOpen(false);
    };
    globalThis.addEventListener("click", handleClick);
    return () => globalThis.removeEventListener("click", handleClick);
  }, [open]);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
    requestPointerLock();
  };

  return (
    <SelectWrapper ref={wrapperRef} className={className}>
      <SelectButton
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <Chevron />
      </SelectButton>
      {open && !disabled && (
        <SelectMenu role="listbox" aria-activedescendant={value}>
          {options.map((option) => (
            <Option
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </Option>
          ))}
        </SelectMenu>
      )}
    </SelectWrapper>
  );
};
