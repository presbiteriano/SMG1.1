import { BookOpen, Camera, Clock, History, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SponsorDTO } from '@/lib/data/dto';
import { formatRome, romeDateKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

/** Scorciatoie a cerchio, come gli highlight di Instagram (brief 5). */
export function ShortcutCircles({ year }: { year: number | null }) {
  const items: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/edizioni', label: m.nav.editionsLabel, icon: History },
    { href: '/albo-doro', label: m.nav.hallShort, icon: Trophy },
    { href: year ? `/foto?edizione=${year}` : '/foto', label: m.nav.photos, icon: Camera },
    { href: '/regolamento', label: m.nav.rulesShort, icon: BookOpen },
  ];
  return (
    <nav aria-label={m.home.shortcuts}>
      <ul className="rail gap-4 py-1 sm:gap-6">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link href={item.href} className="group flex w-[4.75rem] flex-col items-center gap-1.5 text-center">
              <span className="grid size-[4.25rem] place-items-center rounded-full border-2 border-ink bg-accent p-0.5 text-on-accent ring-2 ring-surface ring-inset transition-transform group-hover:scale-105">
                <item.icon aria-hidden className="size-7" strokeWidth={2} />
              </span>
              <span className="kicker text-xs">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SponsorTile({ sponsor, large }: { sponsor: SponsorDTO; large: boolean }) {
  const content = sponsor.logoId ? (
    // eslint-disable-next-line @next/next/no-img-element -- l'immagine passa da /media, che controlla l'approvazione
    <img src={`/media/${sponsor.logoId}?w=240`} alt={sponsor.name} loading="lazy" decoding="async" className={cx('max-w-full object-contain', large ? 'h-16' : 'h-10')} />
  ) : (
    <span className={cx('display text-center leading-tight', large ? 'text-2xl' : 'text-lg')}>{sponsor.name}</span>
  );
  const box = cx('card flex items-center justify-center px-4 shadow-none', large ? 'min-h-28' : 'min-h-16 min-w-40');
  if (!sponsor.url) return <div className={box}>{content}</div>;
  return (
    // Il click passa da /api/go: viene contato senza cookie, poi si va al sito dello sponsor.
    <a href={`/api/go/${sponsor.id}`} rel="sponsored noopener" aria-label={fmt(m.sponsors.visit, { name: sponsor.name })} className={cx(box, 'transition-colors hover:border-ink')}>
      {content}
    </a>
  );
}

export function SponsorStrip({ sponsors }: { sponsors: SponsorDTO[] }) {
  if (sponsors.length === 0) return null;
  return (
    // tabIndex: la striscia scorre in orizzontale e deve poterlo fare anche da tastiera, pure senza collegamenti dentro.
    <ul className="rail gap-3 py-1" tabIndex={0} aria-label={m.nav.sponsors}>
      {sponsors.map((sponsor) => (
        <li key={sponsor.id} className="shrink-0">
          <SponsorTile sponsor={sponsor} large={false} />
        </li>
      ))}
    </ul>
  );
}

export function SponsorGrid({ sponsors }: { sponsors: SponsorDTO[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sponsors.map((sponsor) => (
        <li key={sponsor.id}>
          <SponsorTile sponsor={sponsor} large />
        </li>
      ))}
    </ul>
  );
}

/** «Dati aggiornati alle HH:MM»: sempre visibile dove ci sono risultati, utile con poca rete (brief 8 e 10). */
export function DataFreshness({ generatedAt, degraded, className }: { generatedAt: string; degraded: boolean; className?: string }) {
  const sameDay = romeDateKey(generatedAt) === romeDateKey(new Date());
  const text = sameDay
    ? fmt(m.common.updatedAt, { time: formatRome(generatedAt, 'time') })
    : fmt(m.common.updatedAtDate, { date: formatRome(generatedAt, 'dateShort'), time: formatRome(generatedAt, 'time') });
  return (
    <p className={cx('flex items-center gap-1.5 text-sm text-muted', className)}>
      <Clock aria-hidden className="size-4" />
      <span>
        {text}
        {degraded ? ` ${m.common.degraded}` : ''}
      </span>
    </p>
  );
}

/** Testo lungo scritto dal titolare: paragrafi, titoli (##) ed elenchi (-). Nessun HTML viene interpretato. */
export function RichText({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push(<p key={blocks.length}>{paragraph.join(' ')}</p>);
    if (list.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {list.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>,
      );
    }
    paragraph = [];
    list = [];
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') flush();
    else if (line.startsWith('## ')) {
      flush();
      blocks.push(
        <h2 key={blocks.length} className="pt-3 text-2xl">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('- ')) {
      if (paragraph.length > 0) flush();
      list.push(line.slice(2));
    } else {
      if (list.length > 0) flush();
      paragraph.push(line);
    }
  }
  flush();
  return <div className="max-w-2xl space-y-3 text-[1.0625rem] leading-relaxed">{blocks}</div>;
}
