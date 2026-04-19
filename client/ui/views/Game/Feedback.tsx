import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { feedbackVar } from "@/vars/feedback.ts";

const FeedbackContainer = styled.div`
  position: absolute;
  bottom: 240px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.game.gold};
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.9), -1px -1px 0 rgba(0, 0, 0, 0.3);
`;

export const Feedback = () => {
  const feedback = useReactiveVar(feedbackVar);

  if (!feedback) return null;

  return <FeedbackContainer>{feedback}</FeedbackContainer>;
};
