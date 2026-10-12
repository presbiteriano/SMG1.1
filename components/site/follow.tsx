'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FOLLOW_KEY, setStored, useStored } from '@/lib/client/stored';
import type { Messages } from '@/lib/i18n';
import { cx } from '@/lib/ui';

// «Segui la tua squadra» (brief 8): la scelta resta nel browser, senza account. In header compare
// un chip con posizione e prossima partita, e la squadra è evidenziata in ogni pagina.

type FollowLabels = Messages['follow'];
type Brief = { slug: string; name: string; code: string; position: string | null; next: string | null; nextHref: string | null };

const validSlug = (value: string | null): value is string => value !== null && /^[a-z0-9-]{1,60}$/.test(value);

export function FollowButton({ slug, name, labels }: { slug: string; name: string; labels: FollowLabels }) {
  const followed = useStored(FOLLOW_KEY) === slug;
  return (
    <div>
      <button
        type="button"
        aria-pressed={followed}
        onClick={() => setStored(FOLLOW_KEY, followed ? null : slug)}
        className={cx(
          'inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-display text-lg font-bold uppercase tracking-wide',
          followed ? 'bg-inverse text-on-inverse on-dark' : 'border-2 border-ink',
        )}
      >
        <Star aria-hidden className="size-5" fill={followed ? 'currentColor' : 'none'} />
        {followed ? labels.unfollow : labels.follow}
      </button>
      <p className="mt-1.5 text-sm text-muted" aria-live="polite">
        {followed ? labels.following.replace('{team}', name) : labels.help}
      </p>
    </div>
  );
}

/** Evidenzia la squadra seguita ovunque compaia: tutti gli elementi con data-team uguale alla sua chiave. */
function FollowHighlight({ slug }: { slug: string }) {
  return <style>{`[data-team="${slug}"]{background:var(--surface-2);box-shadow:inset 3px 0 0 var(--smg-ink)}`}</style>;
}

export function FollowChip({ labels }: { labels: FollowLabels }) {
  const stored = useStored(FOLLOW_KEY);
  const slug = validSlug(stored) ? stored : null;
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/follow/${slug}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Brief | null) => {
        if (!cancelled) setBrief(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return null;
  const current = brief?.slug === slug ? brief : null;
  return (
    <>
      <FollowHighlight slug={slug} />
      {current ? (
        <div className="no-print border-b border-line bg-surface">
          <div className="container-page flex min-h-11 items-center gap-x-3 gap-y-0.5 overflow-x-auto text-sm whitespace-nowrap">
            <Star aria-hidden className="size-4 shrink-0" fill="currentColor" />
            <Link href={`/squadre/${current.slug}`} aria-label={labels.open.replace('{team}', current.name)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              <span className="kicker mr-1.5 text-xs no-underline">{labels.chipLabel}</span>
              {current.name}
            </Link>
            {current.position ? <span className="text-muted">· {current.position}</span> : null}
            {current.next ? (
              <span className="text-muted">
                ·{' '}
                {current.nextHref ? (
                  <Link href={current.nextHref} className="underline underline-offset-4">
                    {labels.next.replace('{when}', current.next)}
                  </Link>
                ) : (
                  labels.next.replace('{when}', current.next)
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
