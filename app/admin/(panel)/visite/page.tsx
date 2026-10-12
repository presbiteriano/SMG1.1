import type { Metadata } from 'next';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { requirePermission } from '@/lib/auth/session';
import { loadAnalytics, ORIGINS } from '@/lib/data/analytics';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.admin.analytics.title };

// Statistiche di visita (brief 8): conteggi aggregati, senza cookie, da riportare nel resoconto agli sponsor.
export default async function AnalyticsPage() {
  await requirePermission('analytics.read');
  const days = 30;
  const summary = await loadAnalytics(await getDb(), days);
  const labels = m.admin.analytics;
  const figures: [number, string][] = [
    [summary.pageviews, labels.pageviews],
    [summary.entries, labels.entries],
    [summary.sponsorClicks, labels.sponsorClicks],
    [summary.shares, labels.shares],
    [summary.registrations, labels.registrations],
  ];

  return (
    <>
      <AdminTitle title={labels.title} text={`${labels.text} ${fmt(labels.range, { n: days })}.`} />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {figures.map(([value, label]) => (
          <div key={label} className="card p-4">
            <dd className="display text-4xl tabular-nums">{value.toLocaleString('it-IT')}</dd>
            <dt className="kicker mt-1 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>
      {summary.pageviews === 0 ? (
        <p>{labels.empty}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={labels.origins}>
            <ul className="divide-y divide-line">
              {ORIGINS.map((origin) => (
                <li key={origin} className="flex items-center justify-between py-2">
                  <span>{labels.originLabels[origin]}</span>
                  <span className="display text-xl tabular-nums">{summary.byOrigin[origin]}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={labels.topPages}>
            <ul className="divide-y divide-line">
              {summary.topPages.map((page) => (
                <li key={page.key} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-mono text-sm">{page.key}</span>
                  <span className="display text-xl tabular-nums">{page.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
