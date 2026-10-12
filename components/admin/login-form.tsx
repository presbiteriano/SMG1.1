'use client';

import { useActionState } from 'react';
import { requestLoginLink } from '@/app/admin/(auth)/actions';
import { TextField } from '@/components/form';
import type { Messages } from '@/lib/i18n';
import { StateMessage, submitClass } from './action-form';

export function LoginForm({ labels }: { labels: Messages['admin']['login'] }) {
  const [state, action, pending] = useActionState(requestLoginLink, { status: 'idle' });
  return (
    <form action={action} className="space-y-4">
      <TextField id="email" label={labels.email} type="email" inputMode="email" autoComplete="email" required />
      <button type="submit" disabled={pending} className={`${submitClass.primary} w-full`}>
        {labels.submit}
      </button>
      <StateMessage state={state} />
      {state.extra?.devLink ? (
        <p className="rounded-xl border border-dashed border-ink p-3 text-sm">
          {labels.devLink}{' '}
          <a href={state.extra.devLink} className="font-semibold break-all text-link underline" data-testid="dev-login-link">
            {state.extra.devLink}
          </a>
        </p>
      ) : null}
    </form>
  );
}
