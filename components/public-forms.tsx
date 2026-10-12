'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, type RefObject } from 'react';
import { submitRegistration, submitRemoval, type FormState } from '@/app/(public)/actions';
import type { Messages } from '@/lib/i18n';
import { CheckboxField, FieldError, Honeypot, SelectField, TextAreaField, TextField } from './form';
import { buttonClass } from './ui';

const initial: FormState = { status: 'idle', errors: {}, values: {} };

/** Dopo l'invio porta lettore di schermo e vista sull'esito: conferma oppure primo errore. */
function useOutcomeFocus(state: FormState) {
  const outcome = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== 'idle') outcome.current?.focus();
  }, [state]);
  return outcome;
}

function Success({ title, text, extra, innerRef }: { title: string; text: string; extra?: string; innerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} tabIndex={-1} role="status" className="floodlit rounded-card p-6 outline-none sm:p-8">
      <p className="display text-4xl sm:text-5xl">{title}</p>
      <p className="mt-2 text-xl font-semibold">{text}</p>
      {extra ? <p className="mt-3">{extra}</p> : null}
    </div>
  );
}

export function RegistrationForm({ labels, optionalLabel }: { labels: Messages['registration']; optionalLabel: string }) {
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const outcome = useOutcomeFocus(state);
  if (state.status === 'ok') return <Success title={labels.successTitle} text={labels.successText} extra={labels.successNext} innerRef={outcome} />;
  const { errors, values } = state;

  return (
    <form action={action} noValidate className="relative space-y-8">
      <div ref={outcome} tabIndex={-1} role="alert" className="outline-none">
        {errors.form ? <p className="rounded-xl border-2 border-ink p-4 font-semibold">{errors.form}</p> : null}
      </div>
      <Honeypot label={labels.trap} />

      <fieldset className="space-y-5">
        <legend className="display mb-4 text-2xl">{labels.legend}</legend>
        <TextField id="teamName" label={labels.teamName} required autoComplete="off" defaultValue={values.teamName} error={errors.teamName} maxLength={80} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="playersCount" label={labels.playersCount} optionalLabel={optionalLabel} inputMode="numeric" defaultValue={values.playersCount} error={errors.playersCount} maxLength={2} />
          <TextField id="kitColor" label={labels.kitColor} optionalLabel={optionalLabel} help={labels.kitColorHelp} defaultValue={values.kitColor} error={errors.kitColor} maxLength={40} />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="display mb-1 text-2xl">{labels.contactLegend}</legend>
        <p className="text-muted">{labels.contactHelp}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="firstName" label={labels.contactFirstName} required autoComplete="given-name" defaultValue={values.firstName} error={errors.firstName} maxLength={60} />
          <TextField id="lastName" label={labels.contactLastName} required autoComplete="family-name" defaultValue={values.lastName} error={errors.lastName} maxLength={60} />
          <TextField id="phone" label={labels.phone} required type="tel" inputMode="tel" autoComplete="tel" help={labels.phoneHelp} defaultValue={values.phone} error={errors.phone} maxLength={20} />
          <TextField id="email" label={labels.email} required type="email" inputMode="email" autoComplete="email" defaultValue={values.email} error={errors.email} maxLength={200} />
        </div>
        <TextAreaField id="notes" label={labels.notes} optionalLabel={optionalLabel} help={labels.notesHelp} defaultValue={values.notes} error={errors.notes} maxLength={600} />
      </fieldset>

      <div className="space-y-2">
        <CheckboxField id="hasMinors" label={labels.hasMinors} defaultChecked={values.hasMinors === 'on'}>
          <p className="ml-9 text-sm text-muted">{labels.minorsInfo}</p>
        </CheckboxField>
        <CheckboxField
          id="consentRules"
          required
          error={errors.consentRules}
          label={
            <>
              {labels.consentRules}{' '}
              <Link href="/regolamento" target="_blank" className="font-semibold text-link underline">
                {labels.readRules}
              </Link>
            </>
          }
        />
        <CheckboxField
          id="consentPrivacy"
          required
          error={errors.consentPrivacy}
          label={
            <>
              {labels.consentPrivacy}{' '}
              <Link href="/privacy" target="_blank" className="font-semibold text-link underline">
                {labels.readPrivacy}
              </Link>
            </>
          }
        />
      </div>

      <button type="submit" disabled={pending} className={buttonClass('primary', 'w-full sm:w-auto')}>
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}

export function RemovalForm({ labels, readPrivacy, trap }: { labels: Messages['legal']['removal']; readPrivacy: string; trap: string }) {
  const [state, action, pending] = useActionState(submitRemoval, initial);
  const outcome = useOutcomeFocus(state);
  if (state.status === 'ok') return <Success title={labels.successTitle} text={labels.successText} innerRef={outcome} />;
  const { errors, values } = state;

  return (
    <form action={action} noValidate className="relative space-y-5">
      <div ref={outcome} tabIndex={-1} role="alert" className="outline-none">
        <FieldError id="rimozione-errore" message={errors.form} />
      </div>
      <Honeypot label={trap} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField id="subject" label={labels.subject} defaultValue={values.subject || 'photo'}>
          {(Object.keys(labels.subjects) as (keyof typeof labels.subjects)[]).map((key) => (
            <option key={key} value={key}>
              {labels.subjects[key]}
            </option>
          ))}
        </SelectField>
        <SelectField id="role" label={labels.role} defaultValue={values.role || 'self'}>
          {(Object.keys(labels.roles) as (keyof typeof labels.roles)[]).map((key) => (
            <option key={key} value={key}>
              {labels.roles[key]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField id="reference" label={labels.reference} help={labels.referenceHelp} required rows={3} defaultValue={values.reference} error={errors.reference} maxLength={500} />
      <TextField id="email" label={labels.email} help={labels.emailHelp} required type="email" inputMode="email" autoComplete="email" defaultValue={values.email} error={errors.email} maxLength={200} />
      <TextAreaField id="message" label={labels.message} rows={3} defaultValue={values.message} maxLength={1000} />
      <CheckboxField
        id="consent"
        required
        error={errors.consent}
        label={
          <>
            {labels.consent}{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-link underline">
              {readPrivacy}
            </Link>
          </>
        }
      />
      <button type="submit" disabled={pending} className={buttonClass('primary', 'w-full sm:w-auto')}>
        {labels.submit}
      </button>
    </form>
  );
}
