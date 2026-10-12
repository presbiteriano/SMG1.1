import type { Metadata } from 'next';
import Link from 'next/link';
import { PhotoGrid } from '@/components/photo-grid';
import { EmptyState, PageHeader, TextLink } from '@/components/ui';
import { param, type SearchParams } from '@/lib/data/public';
import { getGallery } from '@/lib/data/queries';
import { countLabel, m } from '@/lib/i18n';
import { parseYear } from '@/lib/site';
import { cx } from '@/lib/ui';

export const metadata: Metadata = { title: m.gallery.title, description: m.gallery.question };

// Galleria (brief 7.11): per edizione, solo foto approvate e con le liberatorie in regola.
export default async function GalleryPage({ searchParams }: { searchParams: SearchParams }) {
  const { data: all } = await getGallery(null);
  const years = [...new Set(all.flatMap((photo) => (photo.year ? [photo.year] : [])))].sort((a, b) => b - a);
  const requested = parseYear(param(await searchParams, 'edizione') ?? undefined);
  const year = requested !== null && years.includes(requested) ? requested : null;
  const photos = year === null ? all : all.filter((photo) => photo.year === year);
  const chip = 'kicker inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm';

  return (
    <>
      <PageHeader title={m.gallery.title} question={m.gallery.question} />
      <div className="container-page space-y-6 pb-10">
        {years.length > 1 ? (
          <nav aria-label={m.gallery.edition}>
            <ul className="rail gap-2">
              <li>
                <Link href="/foto" aria-current={year === null ? 'true' : undefined} className={cx(chip, year === null ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                  {m.teams.allEditions}
                </Link>
              </li>
              {years.map((item) => (
                <li key={item}>
                  <Link href={`/foto?edizione=${item}`} aria-current={year === item ? 'true' : undefined} className={cx(chip, year === item ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {photos.length === 0 ? (
          <EmptyState title={m.gallery.empty} />
        ) : (
          <>
            <p className="text-sm text-muted">{countLabel(photos.length, m.gallery.count, m.gallery.count)}</p>
            <PhotoGrid photos={photos} labels={m.gallery} />
          </>
        )}

        <p className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-1 p-4 shadow-none">
          <span>{m.gallery.removalNote}</span>
          <TextLink href="/rimozione-contenuti">{m.gallery.removalCta}</TextLink>
        </p>
      </div>
    </>
  );
}
