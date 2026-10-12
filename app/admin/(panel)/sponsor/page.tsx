import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { CheckboxField, TextField } from '@/components/form';
import { editions, sponsorEditions, sponsors } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { loadAnalytics } from '@/lib/data/analytics';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';
import { deleteSponsor, saveSponsor } from '../foto/actions';

export const metadata: Metadata = { title: m.admin.sponsors.title };

type SponsorRow = typeof sponsors.$inferSelect;

// Sponsor (brief 7.10): nome, sito, logo, fascia, periodo di visibilità ed edizioni collegate.
export default async function AdminSponsorsPage() {
  await requirePermission('sponsors.write');
  const db = await getDb();
  const rows = await db.select().from(sponsors).orderBy(asc(sponsors.order), asc(sponsors.name));
  const links = await db.select().from(sponsorEditions);
  const editionRows = await db.select().from(editions).orderBy(asc(editions.year));
  const clicks = (await loadAnalytics(db, 365)).sponsorClicksById;
  const labels = m.admin.sponsors;

  const form = (sponsor: SponsorRow | null) => {
    const prefix = sponsor ? `s${sponsor.id}` : 'nuovo';
    return (
      <ActionForm action={saveSponsor} submitLabel={sponsor ? m.admin.common.save : m.admin.common.create} variant={sponsor ? 'quiet' : 'primary'} className="space-y-4">
        {sponsor ? <input type="hidden" name="id" value={sponsor.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={`${prefix}-name`} name="name" label={labels.name} required maxLength={80} defaultValue={sponsor?.name} />
          <TextField id={`${prefix}-url`} name="url" label={labels.url} type="url" placeholder="https://" defaultValue={sponsor?.url ?? ''} />
          <TextField id={`${prefix}-tier`} name="tier" label={labels.tier} defaultValue={sponsor?.tier ?? 'standard'} maxLength={30} />
          <TextField id={`${prefix}-order`} name="order" label={labels.order} inputMode="numeric" defaultValue={sponsor?.order ?? rows.length + 1} maxLength={3} />
          <TextField id={`${prefix}-from`} name="visibleFrom" label={labels.from} type="date" defaultValue={sponsor?.visibleFrom ?? ''} />
          <TextField id={`${prefix}-to`} name="visibleTo" label={labels.to} type="date" defaultValue={sponsor?.visibleTo ?? ''} />
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">{labels.logo}</span>
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block w-full text-sm" />
          <span className="mt-1 block text-sm text-muted">{labels.logoHelp}</span>
        </label>
        <fieldset>
          <legend className="mb-1 font-semibold">{labels.editions}</legend>
          <div className="flex flex-wrap gap-x-5">
            {editionRows.map((edition) => (
              <CheckboxField
                key={edition.id}
                id={`${prefix}-edition-${edition.id}`}
                name="editionIds"
                value={edition.id}
                label={String(edition.year)}
                defaultChecked={sponsor ? links.some((link) => link.sponsorId === sponsor.id && link.editionId === edition.id) : edition.id === editionRows.at(-1)?.id}
              />
            ))}
          </div>
        </fieldset>
      </ActionForm>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <AdminTitle title={labels.title} />
        {rows.length === 0 ? (
          <p className="text-lg">{labels.empty}</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((sponsor) => (
              <li key={sponsor.id} className="card p-4">
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-lg font-semibold">
                    <span>{sponsor.name}</span>
                    <span className="text-sm font-normal text-muted">{fmt(m.sponsors.sponsorClicks, {})}: {clicks.find((item) => item.key === String(sponsor.id))?.count ?? 0}</span>
                  </summary>
                  <div className="mt-4">{form(sponsor)}</div>
                  <ActionForm action={deleteSponsor} submitLabel={m.admin.common.delete} variant="quiet" confirmText={`${m.admin.common.delete}: ${sponsor.name}?`}>
                    <input type="hidden" name="id" value={sponsor.id} />
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Panel title={labels.new}>{form(null)}</Panel>
    </div>
  );
}
