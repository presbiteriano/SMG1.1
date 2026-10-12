'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { saveResult } from '@/app/admin/(panel)/partite/actions';
import type { MatchStatus } from '@/db/schema/enums';
import type { Messages } from '@/lib/i18n';
import { StateMessage, submitClass } from './action-form';

// Inserimento del risultato in tre tocchi (brief 9): si arriva qui toccando la partita, si regola
// il punteggio con i pulsanti grandi e si salva. Pensato per il telefono, in piedi, con poca luce.

type Labels = Messages['admin']['result'];

export type ScorePadMatch = {
  id: number;
  version: number;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  /** Fase a eliminazione: in parità servono i rigori. */
  knockout: boolean;
};

function Stepper({ label, value, onChange, minus, plus, big }: { label: string; value: number; onChange: (next: number) => void; minus: string; plus: string; big: boolean }) {
  const button = big ? 'grid size-16 place-items-center rounded-2xl border-2 border-ink active:bg-surface-2 disabled:opacity-30' : 'grid size-12 place-items-center rounded-xl border-2 border-ink active:bg-surface-2 disabled:opacity-30';
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={big ? 'min-w-0 flex-1 text-lg leading-tight font-semibold' : 'min-w-0 flex-1 leading-tight font-semibold'}>{label}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={button} aria-label={minus} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
          <Minus aria-hidden className={big ? 'size-8' : 'size-6'} strokeWidth={3} />
        </button>
        <output aria-live="polite" className={big ? 'display w-16 text-center text-6xl tabular-nums' : 'display w-12 text-center text-4xl tabular-nums'}>
          {value}
        </output>
        <button type="button" className={button} aria-label={plus} onClick={() => onChange(Math.min(99, value + 1))}>
          <Plus aria-hidden className={big ? 'size-8' : 'size-6'} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function ScoreFields({ match, homeName, awayName, labels }: { match: ScorePadMatch; homeName: string; awayName: string; labels: Labels }) {
  const [home, setHome] = useState(match.homeScore ?? 0);
  const [away, setAway] = useState(match.awayScore ?? 0);
  const [homePens, setHomePens] = useState(match.homePens ?? 0);
  const [awayPens, setAwayPens] = useState(match.awayPens ?? 0);
  const needsPens = match.knockout && home === away;
  const name = (template: string, team: string) => template.replace('{team}', team);

  return (
    <div className="space-y-4">
      <input type="hidden" name="id" value={match.id} />
      <input type="hidden" name="version" value={match.version} />
      <input type="hidden" name="homeScore" value={home} />
      <input type="hidden" name="awayScore" value={away} />
      {needsPens ? (
        <>
          <input type="hidden" name="homePens" value={homePens} />
          <input type="hidden" name="awayPens" value={awayPens} />
        </>
      ) : null}
      <Stepper big label={homeName} value={home} onChange={setHome} minus={name(labels.minus, homeName)} plus={name(labels.plus, homeName)} />
      <Stepper big label={awayName} value={away} onChange={setAway} minus={name(labels.minus, awayName)} plus={name(labels.plus, awayName)} />
      {needsPens ? (
        <fieldset className="space-y-3 rounded-xl bg-surface-2 p-3">
          <legend className="kicker px-1 text-sm">{labels.pensTitle}</legend>
          <p className="text-sm text-muted">{labels.pensHelp}</p>
          <Stepper big={false} label={homeName} value={homePens} onChange={setHomePens} minus={name(labels.pensMinus, homeName)} plus={name(labels.pensPlus, homeName)} />
          <Stepper big={false} label={awayName} value={awayPens} onChange={setAwayPens} minus={name(labels.pensMinus, awayName)} plus={name(labels.pensPlus, awayName)} />
        </fieldset>
      ) : null}
    </div>
  );
}

export function ScorePad({ match, homeName, awayName, labels }: { match: ScorePadMatch; homeName: string; awayName: string; labels: Labels }) {
  const [state, action, pending] = useActionState(saveResult, { status: 'idle' });
  const [intent, setIntent] = useState<'finished' | 'live'>('finished');
  const router = useRouter();

  // Se nel frattempo qualcun altro ha salvato, si ricaricano i dati veri prima di riprovare.
  useEffect(() => {
    if (state.status === 'conflict') router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="status" value={intent} />
      {/* A ogni nuova versione i campi ripartono dal punteggio salvato. */}
      <ScoreFields key={match.version} match={match} homeName={homeName} awayName={awayName} labels={labels} />

      {state.status === 'confirm' ? (
        <div role="alert" className="space-y-3 rounded-xl border-2 border-ink p-4">
          <p className="display text-xl">{labels.confirmTitle}</p>
          <ul className="list-disc space-y-1 pl-5">
            {state.warnings?.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <button type="submit" name="confirm" value="on" disabled={pending} className={`${submitClass.primary} w-full`}>
            {labels.confirmSave}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="submit" disabled={pending} onClick={() => setIntent('finished')} className={`${submitClass.primary} min-h-16 w-full text-xl`}>
            {labels.saveFinal}
          </button>
          <button type="submit" disabled={pending} onClick={() => setIntent('live')} className={`${submitClass.outline} w-full`}>
            {labels.saveLive}
          </button>
        </div>
      )}
      <StateMessage state={state} />
    </form>
  );
}
