'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/admin/action';
import { cx } from '@/lib/ui';

type Action = (previous: ActionState, data: FormData) => Promise<ActionState>;

export function StateMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null;
  const good = state.status === 'ok';
  return (
    <p role={good ? 'status' : 'alert'} className={cx('flex items-start gap-2 rounded-xl p-3 font-semibold', good ? 'bg-surface-2' : 'border-2 border-ink')}>
      {good ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />}
      <span>{state.message}</span>
    </p>
  );
}

const SUBMIT = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-display text-lg font-bold uppercase tracking-wide disabled:opacity-50';
export const submitClass = {
  primary: cx(SUBMIT, 'bg-inverse text-on-inverse'),
  outline: cx(SUBMIT, 'border-2 border-ink'),
  quiet: cx(SUBMIT, 'min-h-11 border border-line px-4 text-base'),
};

/**
 * Modulo del pannello collegato a un'azione sul server: mostra l'esito, disattiva il pulsante
 * mentre salva e funziona anche senza JavaScript.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = 'primary',
  className,
  confirmText,
  errorsFor,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof submitClass;
  className?: string;
  /** Domanda di conferma prima di inviare (azioni che tolgono qualcosa). */
  confirmText?: string;
  /** Campi di cui mostrare l'errore sotto al modulo. */
  errorsFor?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' });
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {children}
      {errorsFor?.map((key) => (state.errors?.[key] ? <p key={key} className="mt-1 text-sm font-semibold">{state.errors[key]}</p> : null))}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={submitClass[variant]}>
          {pending && pendingLabel ? pendingLabel : submitLabel}
        </button>
        <StateMessage state={state} />
      </div>
    </form>
  );
}
