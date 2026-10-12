'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { FOLLOW_KEY, useStored } from '@/lib/client/stored';
import { cx } from '@/lib/ui';

export type FilterOption = { value: string; label: string };
export type FilterField = { name: string; label: string; anyLabel: string; options: FilterOption[]; value: string };

const selectClass = 'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base';

/**
 * Filtri del calendario. È un normale modulo che scrive i filtri nell'indirizzo (link condivisibili);
 * dove c'è JavaScript si applica da solo a ogni scelta, altrimenti resta il pulsante.
 */
export function CalendarFilters({
  action,
  fields,
  hidden,
  labels,
  hasFilters,
}: {
  action: string;
  fields: FilterField[];
  hidden: Record<string, string>;
  labels: { title: string; apply: string; reset: string };
  hasFilters: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} method="get" aria-label={labels.title} className="no-print grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name} className="block">
          <span className="kicker mb-1 block text-xs text-muted">{field.label}</span>
          <select name={field.name} defaultValue={field.value} className={selectClass} onChange={() => form.current?.requestSubmit()}>
            <option value="">{field.anyLabel}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
        <button type="submit" className="min-h-11 rounded-full border-2 border-ink px-4 font-display text-base font-bold uppercase">
          {labels.apply}
        </button>
        {hasFilters ? (
          <Link href={action} className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline">
            {labels.reset}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Scorciatoia «Solo la mia squadra»: compare se si segue una squadra che gioca in questa edizione. */
export function FollowedFilter({ action, teams, label, active }: { action: string; teams: { slug: string; name: string }[]; label: string; active: string | null }) {
  const followed = useStored(FOLLOW_KEY);
  const team = teams.find((item) => item.slug === followed);
  if (!team) return null;
  const on = active === team.slug;
  return (
    <Link
      href={on ? action : `${action}?squadra=${team.slug}`}
      aria-current={on ? 'true' : undefined}
      className={cx('no-print inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold', on ? 'bg-inverse text-on-inverse' : 'border border-ink')}
    >
      {label.replace('{team}', team.name)}
    </Link>
  );
}
