'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { TeamIndexEntry } from '@/lib/data/dto';
import { foldText } from '@/lib/slug';
import { TeamCrest } from './team-crest';

/** Elenco squadre con ricerca immediata: tollera accenti e maiuscole. */
export function TeamSearch({ teams, labels }: { teams: (TeamIndexEntry & { note: string })[]; labels: { label: string; placeholder: string; noMatch: string } }) {
  const [query, setQuery] = useState('');
  const needle = foldText(query.trim());
  const visible = needle ? teams.filter((team) => foldText(`${team.name} ${team.code}`).includes(needle)) : teams;
  return (
    <div className="space-y-5">
      <label className="relative block max-w-md">
        <span className="sr-only">{labels.label}</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.placeholder}
          autoComplete="off"
          className="min-h-12 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-base placeholder:text-muted"
        />
      </label>
      <p role="status" className={visible.length === 0 ? 'text-muted' : 'sr-only'}>
        {visible.length === 0 ? labels.noMatch : `${visible.length}`}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((team) => (
          <li key={team.teamId}>
            <Link href={`/squadre/${team.slug}`} data-team={team.slug} className="card flex min-h-16 items-center gap-3 p-3 transition-colors hover:border-ink">
              <TeamCrest team={team} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{team.name}</span>
                <span className="block text-sm text-muted">{team.note}</span>
              </span>
              <span className="display text-xl text-muted">{team.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
