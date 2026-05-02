import { styled } from "styled-components";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { MonoInput } from "@/components/forms/TextInput.tsx";
import { RotateCcw } from "lucide-react";
import {
  mouse,
  type MouseButtonEvent,
  type MouseMoveEvent,
} from "../../../mouse.ts";

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const InputCell = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
`;

const ResetButton = styled.button`
  position: absolute;
  right: 6px;
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

type NumericSettingInputProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: string;
  disabled: boolean;
  onChange: (value: number) => void;
  isAuto?: boolean;
  onResetToAuto?: () => void;
  tooltip?: React.ReactNode;
  leftAdornment?: ReactNode;
};

const SCRUB_THRESHOLD_PX = 4;
const SCRUB_PIXELS_PER_STEP = 4;

const clampToRange = (value: number, min: number, max: number, step: number) =>
  step === 1
    ? Math.max(min, Math.min(max, value))
    : Math.round(Math.max(min, Math.min(max, value)) / step) * step;

export const NumericSettingInput = ({
  id,
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  disabled,
  onChange,
  isAuto,
  onResetToAuto,
  tooltip: tooltipContent,
  leftAdornment,
}: NumericSettingInputProps) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const { tooltipContainerProps, tooltip } = useTooltip<HTMLLabelElement>(
    tooltipContent,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setLocalValue(value.toString()), [value]);

  const parseValue = step === 1 ? parseInt : parseFloat;

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value === "") {
      setLocalValue(defaultValue);
      if (parseValue(defaultValue) !== value) {
        onChange(parseValue(defaultValue));
      }
    } else {
      const parsed = parseValue(e.currentTarget.value);
      const usable = Number.isFinite(parsed)
        ? parsed
        : parseValue(defaultValue);
      const rounded = clampToRange(usable, min, max, step);
      setLocalValue(rounded.toString());
      if (rounded !== value) onChange(rounded);
    }
  };

  // Drag-to-adjust: mousedown on the input arms a scrub gesture. We then
  // attach mouseMove/mouseButtonUp listeners on the game's mouse module
  // (so it works under pointer lock) and detach on release. Crossing
  // SCRUB_THRESHOLD_PX horizontally promotes the gesture from "click" to
  // "scrub": it blurs the input, swaps the cursor, and starts emitting
  // value updates. A release before the threshold falls through to normal
  // focus so the user can still type.
  const propsRef = useRef({ value, min, max, step, onChange });
  propsRef.current = { value, min, max, step, onChange };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();

    const input = e.currentTarget;
    const startX = mouse.pixels.x;
    const startValue = propsRef.current.value;
    let scrubbing = false;
    let lastApplied = startValue;

    const onMove = (_ev: MouseMoveEvent) => {
      const dx = mouse.pixels.x - startX;
      if (!scrubbing) {
        if (Math.abs(dx) < SCRUB_THRESHOLD_PX) return;
        scrubbing = true;
        document.body.style.cursor = "ew-resize";
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      const { min, max, step, onChange } = propsRef.current;
      const steps = Math.round(dx / SCRUB_PIXELS_PER_STEP);
      const next = clampToRange(startValue + steps * step, min, max, step);
      if (next === lastApplied) return;
      lastApplied = next;
      setLocalValue(next.toString());
      onChange(next);
    };

    const onUp = (ev: MouseButtonEvent) => {
      if (ev.button !== "left") return;
      mouse.removeEventListener("mouseMove", onMove);
      mouse.removeEventListener("mouseButtonUp", onUp);
      if (scrubbing) {
        document.body.style.cursor = "";
      } else if (ev.element === input) {
        input.focus();
        input.select();
      }
    };

    mouse.addEventListener("mouseMove", onMove);
    mouse.addEventListener("mouseButtonUp", onUp);
  };

  const showReset = isAuto === false && onResetToAuto;

  return (
    <Field>
      <FieldLabel htmlFor={id} {...tooltipContainerProps}>
        {label}
        {tooltip}
      </FieldLabel>
      <InputWrapper>
        {leftAdornment}
        <InputCell>
          <MonoInput
            id={id}
            ref={inputRef}
            type="number"
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={(e) => setLocalValue(e.currentTarget.value)}
            onBlur={handleBlur}
            onMouseDown={handleMouseDown}
            disabled={disabled}
            style={{
              ...(showReset ? { paddingRight: 28 } : {}),
              ...(isAuto ? { opacity: 0.5 } : {}),
              cursor: disabled ? "not-allowed" : "ew-resize",
            }}
          />
          {showReset && (
            <ResetButton
              type="button"
              onClick={onResetToAuto}
              title="Reset to auto"
            >
              <RotateCcw size={12} />
            </ResetButton>
          )}
        </InputCell>
      </InputWrapper>
    </Field>
  );
};
