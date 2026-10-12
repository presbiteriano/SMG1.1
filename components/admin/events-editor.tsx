'use client';

import { Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { saveEvents } from '@/app/admin/(panel)/partite/actions';
import { inputClass } from '@/components/form';
import type { MatchEventType } from '@/db/schema/enums';
import type { Messages } from '@/lib/i18n';
import { StateMessage, submitClass } from './action-form';

export type EditorEvent = { type: MatchEventType; minute: number | null; teamEntryId: number; rosterEntryId: number | null };
export type EditorTeam = { entryId: number; name: string; players: { rosterId: number; label: string }[] };

type Labels = Messages['admin']['result'];

function EventList({ initial, teams, labels, typeLabels, matchId }: { initial: EditorEvent[]; teams: EditorTeam[]; labels: Labels; typeLabels: Record<MatchEventType, string>; matchId: number }) {
  const [events, setEvents] = useState(initial);
  const [type, setType] = useState<MatchEventType>('goal');
  const [teamId, setTeamId] = useState(teams[0]?.entryId ?? 0);
  const [rosterId, setRosterId] = useState('');
  const [minute, setMinute] = useState('');
  const team = teams.find((item) => item.entryId === teamId);
  const describe = (event: EditorEvent) => {
    const owner = teams.find((item) => item.entryId === event.teamEntryId);
    const player = owner?.players.find((item) => item.rosterId === event.rosterEntryId)?.label ?? labels.eventNoPlayer;
    return `${event.minute !== null ? `${event.minute}' · ` : ''}${typeLabels[event.type]} · ${owner?.name ?? ''} · ${player}`;
  };

  const add = () => {
    const parsedMinute = /^\d{1,3}$/.test(minute) ? Number(minute) : null;
    const next = [...events, { type, minute: parsedMinute, teamEntryId: teamId, rosterEntryId: rosterId ? Number(rosterId) : null }];
    setEvents(next.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)));
    setMinute('');
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="id" value={matchId} />
      <input type="hidden" name="events" value={JSON.stringify(events)} />
      {events.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {events.map((event, index) => (
            <li key={`${index}-${event.type}-${event.minute}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span>{describe(event)}</span>
              <button type="button" aria-label={`${labels.eventRemove}: ${describe(event)}`} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2" onClick={() => setEvents(events.filter((_, position) => position !== index))}>
                <Trash2 aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="block">
          <span className="kicker mb-1 block text-xs text-muted">{labels.eventType}</span>
          <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as MatchEventType)}>
            {(Object.keys(typeLabels) as MatchEventType[]).map((key) => (
              <option key={key} value={key}>
                {typeLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker mb-1 block text-xs text-muted">{labels.eventTeam}</span>
          <select
            className={inputClass}
            value={teamId}
            onChange={(event) => {
              setTeamId(Number(event.target.value));
              setRosterId('');
            }}
          >
            {teams.map((item) => (
              <option key={item.entryId} value={item.entryId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="kicker mb-1 block text-xs text-muted">{labels.eventPlayer}</span>
          <select className={inputClass} value={rosterId} onChange={(event) => setRosterId(event.target.value)}>
            <option value="">{labels.eventNoPlayer}</option>
            {team?.players.map((player) => (
              <option key={player.rosterId} value={player.rosterId}>
                {player.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker mb-1 block text-xs text-muted">{labels.eventMinute}</span>
          <input className={inputClass} inputMode="numeric" value={minute} onChange={(event) => setMinute(event.target.value)} maxLength={3} />
        </label>
        <div className="flex items-end">
          <button type="button" className={`${submitClass.quiet} w-full`} onClick={add} disabled={!teamId}>
            {labels.eventAdd}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Marcatori, cartellini e migliore in campo: facoltativi, si possono aggiungere anche dopo (brief 9). */
export function EventsEditor(props: { initial: EditorEvent[]; teams: EditorTeam[]; labels: Labels; typeLabels: Record<MatchEventType, string>; matchId: number; version: number; saveLabel: string }) {
  const [state, action, pending] = useActionState(saveEvents, { status: 'idle' });
  return (
    <form action={action} className="space-y-4">
      <EventList key={props.version} initial={props.initial} teams={props.teams} labels={props.labels} typeLabels={props.typeLabels} matchId={props.matchId} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={submitClass.outline}>
          {props.saveLabel}
        </button>
        <StateMessage state={state} />
      </div>
    </form>
  );
}
