import { styled } from "styled-components";
import { useEffect, useState } from "react";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { MonoInput } from "@/components/forms/TextInput.tsx";
import { RotateCcw } from "lucide-react";

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
};

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
}: NumericSettingInputProps) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const { tooltipContainerProps, tooltip } = useTooltip<HTMLLabelElement>(
    tooltipContent,
  );

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
      const clamped = Math.max(min, Math.min(max, usable));
      const rounded = step === 1 ? clamped : Math.round(clamped / step) * step;
      setLocalValue(rounded.toString());
      if (rounded !== value) onChange(rounded);
    }
  };

  const showReset = isAuto === false && onResetToAuto;

  return (
    <Field>
      <FieldLabel htmlFor={id} {...tooltipContainerProps}>
        {label}
        {tooltip}
      </FieldLabel>
      <InputWrapper>
        <MonoInput
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={(e) => setLocalValue(e.currentTarget.value)}
          onBlur={handleBlur}
          disabled={disabled}
          style={{
            ...(showReset ? { paddingRight: 28 } : {}),
            ...(isAuto ? { opacity: 0.5 } : {}),
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
      </InputWrapper>
    </Field>
  );
};
