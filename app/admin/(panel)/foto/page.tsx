import { and, desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PhotoEditor } from '@/components/admin/photo-editor';
import { PhotoUploader } from '@/components/admin/photo-uploader';
import { AdminTitle, EditionSwitch, Panel } from '@/components/admin/ui';
import { media } from '@/db/schema';
import { workingEdition } from '@/lib/admin/action';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

export const metadata: Metadata = { title: m.admin.photos.title };

const FILTERS = ['draft', 'approved', 'rejected'] as const;
type Filter = (typeof FILTERS)[number];

// Foto (brief 9 e 13.6): caricamento, flag di consenso e presenza di minori, didascalia, crediti;
// pubblicazione solo dopo approvazione.
export default async function AdminPhotosPage({ searchParams }: { searchParams: Promise<{ edizione?: string; stato?: string }> }) {
  const user = await requirePermission('media.upload');
  const query = await searchParams;
  const db = await getDb();
  const { all, current } = await workingEdition(db, query.edizione);
  const filter: Filter = (FILTERS as readonly string[]).includes(query.stato ?? '') ? (query.stato as Filter) : 'draft';
  const labels = m.admin.photos;

  const rows = current
    ? await db
        .select()
        .from(media)
        .where(and(eq(media.kind, 'photo'), eq(media.editionId, current.id)))
        .orderBy(desc(media.createdAt), desc(media.id))
    : [];
  const stateOf = (row: (typeof rows)[number]): Filter => (row.rejectedAt ? 'rejected' : row.approvedAt ? 'approved' : 'draft');
  const visible = rows.filter((row) => stateOf(row) === filter);

  return (
    <>
      <AdminTitle title={labels.title} text={current?.name} />
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin/foto" />

      <Panel className="mb-6">
        <PhotoUploader editionId={current?.id ?? null} labels={labels} creditLabel={labels.credit} />
      </Panel>

      <nav aria-label={labels.filter}>
        <ul className="rail mb-4 gap-2">
          {FILTERS.map((item) => (
            <li key={item}>
              <Link
                href={`/admin/foto?stato=${item}${current ? `&edizione=${current.year}` : ''}`}
                aria-current={filter === item ? 'true' : undefined}
                className={cx('kicker inline-flex min-h-11 items-center rounded-full px-4 text-sm', filter === item ? 'bg-inverse text-on-inverse' : 'border border-line')}
              >
                {labels[item]} ({rows.filter((row) => stateOf(row) === item).length})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <p className="text-lg">{labels.empty}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((row) => (
            <li key={row.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- /media serve le bozze solo a chi è entrato nel pannello */}
              <img src={`/media/${row.id}?w=480`} alt={row.alt ?? ''} width={row.width ?? undefined} height={row.height ?? undefined} loading="lazy" className="aspect-[3/2] w-full bg-surface-2 object-cover" />
              <div className="p-4">
                <PhotoEditor
                  photo={{ id: row.id, alt: row.alt ?? '', caption: row.caption ?? '', credit: row.credit ?? '', containsMinors: row.containsMinors, consentPublish: row.consentPublish, state: stateOf(row) }}
                  canApprove={can(user.role, 'media.approve')}
                  labels={labels}
                  saveLabel={m.admin.common.save}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
