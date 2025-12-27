import { styled } from "styled-components";
import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { practiceVar } from "@/vars/practice.ts";
import { nonNull } from "@/shared/types.ts";

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
  gap: ${({ theme }) => theme.spacing.lg};
  justify-content: space-between;
`;

const Clock = styled.div`
  text-align: right;
`;

export const Timers = () => {
  const timers = useReactiveVar(timersVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const practice = useReactiveVar(practiceVar);
  const players = usePlayers();
  useListenToEntities(players, ["sheepTime"]);

  const allTimers = [
    ...timers.map((t) => {
      const buff = t.buffs?.find((b) => b.expiration);
      if (!buff || !buff.remainingDuration) return null;
      return [
        t.id,
        buff.expiration ?? "",
        formatDuration(buff.remainingDuration * 1000),
      ];
    }).filter(nonNull),
    ...lobbySettings.mode === "switch" && !practice
      ? players.map((p): [string, string, number] => [
        p.id,
        p.name ?? "",
        lobbySettings.time - (p.sheepTime ?? 0),
      ]).sort((a, b) => a[2] - b[2]).map((
        [id, name, remaining],
      ) => [id, name, formatDuration(remaining * 1000, remaining < 10)])
      : [],
  ];

  if (!allTimers.length && !allTimers.length) return;

  return (
    <TimersContainer>
      {allTimers.map(([id, name, remaining]) => (
        <Timer key={id}>
          <span>{name}</span>
          <Clock>{remaining}</Clock>
        </Timer>
      ))}
    </TimersContainer>
  );
};
