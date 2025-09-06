import { styled } from "npm:styled-components";
import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";

const timersVar = makeVar<Entity[]>([]);

app.addSystem({
  props: ["isTimer", "buffs"],
  onAdd: (e) => timersVar([...timersVar(), e]),
  onChange: () => timersVar([...timersVar()]),
  onRemove: (e) => timersVar(timersVar().filter((t) => t !== e)),
});

const TimersContainer = styled(VStack)`
  &:empty {
    display: none;
  }
`;

const Timer = styled(Card)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
  background-color: rgb(from ${({ theme }) =>
    theme.colors.background} r g b / 0.5);
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Clock = styled.div`
  width: 50px;
  text-align: right;
`;

export const Timers = () => {
  const timers = useReactiveVar(timersVar);

  return (
    <TimersContainer>
      {timers.map((t) => {
        const buff = t.buffs?.find((b) => b.expiration);
        if (!buff) return null;
        return (
          <Timer key={t.id}>
            <span>{buff.expiration}</span>
            <Clock>{formatDuration(buff.remainingDuration * 1000)}</Clock>
          </Timer>
        );
      })}
    </TimersContainer>
  );
};
