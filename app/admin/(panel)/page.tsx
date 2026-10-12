import { and, count, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { adminLinkButton, AdminMatchRow, AdminTitle, EditionSwitch } from '@/components/admin/ui';
import { media, registrations, removalRequests } from '@/db/schema';
import { workingEdition } from '@/lib/admin/action';
import { adminEdition } from '@/lib/admin/data';
import { can } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { byKickoff } from '@/lib/bracket/view';
import { getDb } from '@/lib/data/db';
import { formatRome, romeDateKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { matchesOn } from '@/lib/site';

// Prima pagina del pannello: le partite di oggi. Un tocco sulla partita e si inserisce il risultato.
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const { all, current } = await workingEdition(db, (await searchParams).edizione);
  const loaded = current ? await adminEdition(db, current.id) : null;
  const now = new Date();

  const sorted = loaded ? [...loaded.bundle.matches].sort(byKickoff) : [];
  const today = matchesOn(sorted, romeDateKey(now));
  const next = sorted.filter((match) => match.status === 'scheduled' || match.status === 'postponed').slice(0, 4);
  const recent = sorted.filter((match) => match.status === 'finished' || match.status === 'forfeited' || match.status === 'live').slice(-4).reverse();

  const [newRegistrations] = can(user.role, 'registrations.read') ? await db.select({ total: count() }).from(registrations).where(eq(registrations.status, 'new')) : [{ total: 0 }];
  const [pendingPhotos] = can(user.role, 'media.approve')
    ? await db.select({ total: count() }).from(media).where(and(eq(media.kind, 'photo'), isNull(media.approvedAt), isNull(media.rejectedAt)))
    : [{ total: 0 }];
  const [openRemovals] = can(user.role, 'removals.write') ? await db.select({ total: count() }).from(removalRequests).where(eq(removalRequests.status, 'new')) : [{ total: 0 }];
  const todo = [
    { total: openRemovals.total, label: m.admin.today.pendingRemovals, href: '/admin/richieste' },
    { total: newRegistrations.total, label: m.admin.today.newRegistrations, href: '/admin/iscrizioni' },
    { total: pendingPhotos.total, label: m.admin.today.pendingPhotos, href: '/admin/foto' },
  ].filter((item) => item.total > 0);

  return (
    <>
      <AdminTitle title={m.admin.today.title} text={current ? `${current.name} · ${formatRome(now, 'dayLong')}` : undefined}>
        {can(user.role, 'announcements.write') ? (
          <Link href="/admin/avvisi" className={adminLinkButton}>
            {m.admin.today.quickNotice}
          </Link>
        ) : null}
      </AdminTitle>
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin" />

      {todo.length > 0 ? (
        <ul className="mb-5 space-y-2">
          {todo.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-12 items-center rounded-xl border-2 border-ink px-4 font-semibold">
                {fmt(item.label, { n: item.total })}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!current ? (
        <p className="text-lg">{m.admin.today.noEdition}</p>
      ) : today.length > 0 ? (
        <>
          <p className="mb-3 text-muted">{m.admin.today.tapHint}</p>
          <ul className="space-y-3">
            {today.map((match) => (
              <li key={match.id}>
                <AdminMatchRow match={match} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="space-y-6">
          <p className="text-lg font-semibold">{m.admin.today.none}</p>
          {next.length > 0 ? (
            <section>
              <h2 className="mb-3 text-2xl">{m.admin.today.next}</h2>
              <ul className="space-y-3">
                {next.map((match) => (
                  <li key={match.id}>
                    <AdminMatchRow match={match} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {recent.length > 0 ? (
            <section>
              <h2 className="mb-3 text-2xl">{m.admin.today.recent}</h2>
              <ul className="space-y-3">
                {recent.map((match) => (
                  <li key={match.id}>
                    <AdminMatchRow match={match} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
