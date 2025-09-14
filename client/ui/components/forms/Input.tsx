import { styled } from "styled-components";
import { VStack } from "../layout/Layout.tsx";
import { id } from "@/shared/util/id.ts";

export const Input = styled.input`
  border: 0;
  background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 12));
  color: ${({ theme }) => theme.colors.border};
  padding: 0 ${({ theme }) => theme.spacing.sm};

  &.hover:not([disabled]) {
    background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 5));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FieldLabel = styled.label`
  font-size: 12px;
  font-weight: bold;
`;

const FieldWrapper = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const InputField = (
  { label, ...props }: React.ComponentProps<typeof Input> & {
    label?: React.ReactNode;
  },
) => {
  const inputId = props.id ?? id("input-field");
  return (
    <FieldWrapper>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <Input id={inputId} {...props} />
    </FieldWrapper>
  );
};
