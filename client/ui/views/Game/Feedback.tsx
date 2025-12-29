import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { feedbackVar } from "@/vars/feedback.ts";

const FeedbackContainer = styled.div`
  position: absolute;
  bottom: 240px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
`;

export const Feedback = () => {
  const feedback = useReactiveVar(feedbackVar);

  if (!feedback) return null;

  return <FeedbackContainer>{feedback}</FeedbackContainer>;
};
