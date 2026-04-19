import { useEffect, useMemo, useRef, useState } from "react";
import { styled } from "styled-components";
import { ChevronDown } from "lucide-react";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { mouse } from "../../../mouse.ts";

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

const Trigger = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 7px 10px;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.sm};
  min-height: 30px;
  outline: none;
  cursor: pointer;
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.hi};
  }

  &[aria-expanded="true"] {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.accent.bg};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const ChevronIcon = styled(ChevronDown)<{ $open: boolean }>`
  width: 14px;
  height: 14px;
  color: ${({ theme }) => theme.ink.lo};
  flex-shrink: 0;
  transition: transform ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  transform: ${({ $open }) => $open ? "rotate(180deg)" : "none"};
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.space[1]});
  left: 0;
  width: 100%;
  max-height: 220px;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.space[1]};
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  box-shadow: ${({ theme }) => theme.shadow.md};
`;

const OptionItem = styled.div<{ $selected: boolean }>`
  padding: 6px ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.xs};
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.hi};
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.accent.bg : "transparent"};

  &.hover {
    background: ${({ $selected, theme }) =>
      $selected ? theme.accent.bg : theme.surface[2]};
  }
`;

export const Select = ({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Select\u2026",
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
        document.body.requestPointerLock({
          unadjustedMovement: gameplaySettingsVar().rawMouseInput,
        });
      }
    } catch { /* ignore */ }
  };

  const label = useMemo(
    () =>
      options.find((option) => option.value === value)?.label ?? placeholder,
    [options, value, placeholder],
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: { element: Element | null }) => {
      if (
        !wrapperRef.current || !e.element ||
        wrapperRef.current.contains(e.element)
      ) return;
      setOpen(false);
    };
    mouse.addEventListener("mouseButtonDown", handleClick);
    return () => mouse.removeEventListener("mouseButtonDown", handleClick);
  }, [open]);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
    requestPointerLock();
  };

  return (
    <SelectWrapper ref={wrapperRef} className={className}>
      <Trigger
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronIcon $open={open} />
      </Trigger>
      {open && !disabled && (
        <Dropdown role="listbox" aria-activedescendant={value}>
          {options.map((option) => (
            <OptionItem
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              $selected={option.value === value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </OptionItem>
          ))}
        </Dropdown>
      )}
    </SelectWrapper>
  );
};
