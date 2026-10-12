import { cx, isHexColor, readableOn } from '@/lib/ui';

type CrestTeam = { code: string; kitColor: string | null; crestId: number | null };

/**
 * Stemma della squadra. Se manca, cerchio nel colore della maglia con la sigla di tre lettere:
 * mai spazi vuoti (brief 4.6). È decorativo: il nome della squadra è sempre scritto accanto.
 */
export function TeamCrest({ team, size = 28, className }: { team: CrestTeam; size?: number; className?: string }) {
  if (team.crestId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- l'immagine passa da /media, che controlla l'approvazione
      <img
        src={`/media/${team.crestId}?w=${size > 48 ? 240 : 96}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={cx('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const background = isHexColor(team.kitColor) ? team.kitColor : 'var(--surface-2)';
  return (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center rounded-full border border-line font-display font-bold uppercase leading-none', className)}
      style={{ width: size, height: size, background, color: readableOn(isHexColor(team.kitColor) ? team.kitColor : null), fontSize: Math.max(9, Math.round(size * 0.36)) }}
    >
      {team.code}
    </span>
  );
}
