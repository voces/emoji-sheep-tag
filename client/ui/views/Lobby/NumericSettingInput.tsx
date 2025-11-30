import { styled } from "styled-components";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import { Input } from "@/components/forms/Input.tsx";
import { Checkbox } from "@/components/forms/Checkbox.tsx";
import { useEffect, useState } from "react";
import { useTooltip } from "@/hooks/useTooltip.tsx";

const SettingsRow = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SettingsLabel = styled.label`
  font-size: 12px;
  font-weight: bold;
`;

const SettingsInput = styled(Input)`
  &:disabled {
    background-color: #f5f5f5;
    color: #666;
    cursor: not-allowed;
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
  autoChecked?: boolean;
  onAutoChange?: (checked: boolean) => void;
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
  autoChecked,
  onAutoChange,
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
      onChange(parseValue(defaultValue));
    } else {
      const parsed = parseValue(e.currentTarget.value) ||
        parseValue(defaultValue);
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = step === 1 ? clamped : Math.round(clamped * 100) / 100;
      setLocalValue(rounded.toString());
      onChange(rounded);
    }
  };

  const input = (
    <SettingsInput
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={(e) => setLocalValue(e.currentTarget.value)}
      onBlur={handleBlur}
      disabled={disabled || autoChecked}
      style={autoChecked !== undefined ? { flex: 1 } : undefined}
    />
  );

  return (
    <SettingsRow>
      <SettingsLabel htmlFor={id} {...tooltipContainerProps}>
        {label}
        {tooltip}
      </SettingsLabel>
      {autoChecked !== undefined
        ? (
          <HStack $align="center">
            {input}
            <SettingsLabel htmlFor={`${id}-auto`}>Auto</SettingsLabel>
            <Checkbox
              id={`${id}-auto`}
              checked={autoChecked}
              onChange={(e) => onAutoChange?.(e.currentTarget.checked)}
              disabled={disabled}
            />
          </HStack>
        )
        : input}
    </SettingsRow>
  );
};
