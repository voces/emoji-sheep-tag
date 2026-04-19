import { styled } from "styled-components";
import { VStack } from "../layout/Layout.tsx";
import { id } from "@/shared/util/id.ts";

export const Input = styled.input`
  border: 0;
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  padding: 0 ${({ theme }) => theme.space[1]};

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.surface[3]};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
`;

const FieldWrapper = styled(VStack)`
  gap: 2px;
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
