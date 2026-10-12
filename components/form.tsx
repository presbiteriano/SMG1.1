import { CircleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/ui';

// Campi dei moduli: etichetta sempre visibile, errore in italiano accanto al campo (brief 7.9),
// bersagli alti almeno 44 px, usabili con una mano sola.

export const inputClass = 'min-h-12 w-full rounded-xl border border-ink/40 bg-surface px-3.5 text-base placeholder:text-muted aria-[invalid=true]:border-2 aria-[invalid=true]:border-ink';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

type FieldProps = { label: string; error?: string; help?: string; optionalLabel?: string; className?: string };

function describedBy(id: string, error?: string, help?: string): string | undefined {
  return [error ? `${id}-errore` : null, help ? `${id}-aiuto` : null].filter(Boolean).join(' ') || undefined;
}

function Shell({ id, label, error, help, optionalLabel, className, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
        {optionalLabel ? <span className="ml-1.5 text-sm font-normal text-muted">({optionalLabel})</span> : null}
      </label>
      {children}
      {help ? (
        <p id={`${id}-aiuto`} className="mt-1.5 text-sm text-muted">
          {help}
        </p>
      ) : null}
      <FieldError id={`${id}-errore`} message={error} />
    </div>
  );
}

export function TextField({ label, error, help, optionalLabel, className, ...input }: FieldProps & Omit<ComponentProps<'input'>, 'className'> & { id: string }) {
  return (
    <Shell id={input.id} label={label} error={error} help={help} optionalLabel={optionalLabel} className={className}>
      <input {...input} name={input.name ?? input.id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(input.id, error, help)} className={inputClass} />
    </Shell>
  );
}

export function TextAreaField({ label, error, help, optionalLabel, className, ...input }: FieldProps & Omit<ComponentProps<'textarea'>, 'className'> & { id: string }) {
  return (
    <Shell id={input.id} label={label} error={error} help={help} optionalLabel={optionalLabel} className={className}>
      <textarea {...input} name={input.name ?? input.id} rows={input.rows ?? 4} aria-invalid={error ? true : undefined} aria-describedby={describedBy(input.id, error, help)} className={cx(inputClass, 'py-3')} />
    </Shell>
  );
}

export function SelectField({ label, error, help, optionalLabel, className, children, ...input }: FieldProps & Omit<ComponentProps<'select'>, 'className'> & { id: string }) {
  return (
    <Shell id={input.id} label={label} error={error} help={help} optionalLabel={optionalLabel} className={className}>
      <select {...input} name={input.name ?? input.id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(input.id, error, help)} className={inputClass}>
        {children}
      </select>
    </Shell>
  );
}

export function CheckboxField({ id, label, error, children, ...input }: { id: string; label: ReactNode; error?: string; children?: ReactNode } & Omit<ComponentProps<'input'>, 'className' | 'type'>) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
        <input {...input} id={id} name={input.name ?? id} type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-errore` : undefined} className="mt-0.5 size-6 shrink-0 accent-ink" />
        <span>{label}</span>
      </label>
      {children}
      <FieldError id={`${id}-errore`} message={error} />
    </div>
  );
}

/** Campo esca contro lo spam: i robot lo compilano, le persone non lo vedono (brief 7.9). */
export function Honeypot({ label }: { label: string }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        {label}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
