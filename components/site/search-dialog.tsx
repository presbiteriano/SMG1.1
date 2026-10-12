'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Messages } from '@/lib/i18n';
import { searchEntries, type SearchEntry } from '@/lib/search';

/** Ricerca di squadre, giocatori (se pubblici) e partite. L'indice si scarica solo all'apertura. */
export function SearchDialog({ labels, onClose }: { labels: Messages['search']; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    fetch('/api/search')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('search'))))
      .then((data: SearchEntry[]) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = entries ? searchEntries(entries, query) : [];
  const kindLabel = { team: labels.team, player: labels.player, match: labels.match };

  return (
    <dialog
      ref={dialog}
      aria-label={labels.title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget || (event.target as HTMLElement).closest('a')) event.currentTarget.close();
      }}
      className="m-auto mt-0 max-h-[85dvh] w-full max-w-xl rounded-b-card bg-surface p-0 text-text shadow-pop backdrop:bg-ink/60 sm:mt-16 sm:rounded-card"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <Search aria-hidden className="ml-1 size-5 shrink-0 text-muted" />
          <label htmlFor="site-search" className="sr-only">
            {labels.label}
          </label>
          <input
            id="site-search"
            type="search"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.placeholder}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <button type="button" onClick={() => dialog.current?.close()} aria-label={labels.title} className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-2" aria-live="polite">
          {failed ? <p className="p-3 text-muted">{labels.error}</p> : null}
          {!failed && query.trim().length < 2 ? <p className="p-3 text-muted">{labels.hint}</p> : null}
          {!failed && entries && query.trim().length >= 2 && results.length === 0 ? <p className="p-3 text-muted">{labels.empty}</p> : null}
          <ul>
            {results.map((entry) => (
              <li key={`${entry.kind}-${entry.href}-${entry.label}`}>
                <Link href={entry.href} className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{entry.label}</span>
                    <span className="block truncate text-sm text-muted">{entry.detail}</span>
                  </span>
                  <span className="kicker shrink-0 text-xs text-muted">{kindLabel[entry.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
