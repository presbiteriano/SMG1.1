import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { TeamRef } from '@/lib/data/dto';
import { findPublicMatch } from '@/lib/data/lookup';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { BRAND } from '@/lib/tokens/brand';
import { isHexColor, readableOn } from '@/lib/ui';

// «Condividi risultato» (brief 8): immagine con logo, squadre e punteggio, generata sul server.
//   ?formato=storia     1080 x 1920, per le storie
//   ?formato=anteprima  1200 x 630, per le anteprime dei link
// Contiene solo squadre e punteggio: mai nomi di persone.

const assets = (globalThis as unknown as { __smgShareAssets?: Promise<{ display: Buffer; text: Buffer; logo: string }> });

function loadAssets() {
  assets.__smgShareAssets ??= (async () => {
    const root = process.cwd();
    const [display, text, logo] = await Promise.all([
      readFile(path.join(root, 'lib', 'tokens', 'fonts', 'barlow-condensed-800.woff')),
      readFile(path.join(root, 'lib', 'tokens', 'fonts', 'inter-600.woff')),
      readFile(path.join(root, 'public', 'brand', 'icon-512.png')),
    ]);
    return { display, text, logo: `data:image/png;base64,${logo.toString('base64')}` };
  })();
  return assets.__smgShareAssets;
}

const textColor = (team: TeamRef | null) => {
  const variable = readableOn(team && isHexColor(team.kitColor) ? team.kitColor : null);
  return variable === 'var(--smg-white)' ? BRAND.white : BRAND.ink;
};

function Team({ team, placeholder, size }: { team: TeamRef | null; placeholder: string | null; size: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size * 2.1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: size,
          border: `${Math.round(size / 24)}px solid ${BRAND.ink}`,
          background: team && isHexColor(team.kitColor) ? team.kitColor : BRAND.skySoft,
          color: textColor(team),
          fontSize: size * 0.36,
        }}
      >
        {team?.code ?? '?'}
      </div>
      <div style={{ display: 'flex', marginTop: size * 0.12, fontFamily: 'Inter', fontSize: size * 0.2, textAlign: 'center', lineHeight: 1.15 }}>{team?.name ?? placeholder ?? m.match.toBeDecided}</div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await findPublicMatch((await params).id);
  if (!found) return new Response(null, { status: 404 });
  const { match, bundle } = found;
  const url = new URL(request.url);
  const story = url.searchParams.get('formato') !== 'anteprima';
  const width = story ? 1080 : 1200;
  const height = story ? 1920 : 630;
  const unit = story ? 1 : 0.5;
  const { display, text, logo } = await loadAssets();

  const scored = match.homeScore !== null && match.awayScore !== null;
  const status = match.status === 'live' ? m.share.live : scored ? m.share.final : m.share.upcoming;
  const when = match.kickoffAt ? `${formatRome(match.kickoffAt, 'dayLong')} · ${formatRome(match.kickoffAt, 'time')}` : '';

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: story ? '120px 60px' : '36px 48px',
          backgroundColor: BRAND.sky,
          backgroundImage: `radial-gradient(circle at 10% 0%, rgba(255,255,255,0.85), rgba(255,255,255,0) 45%), radial-gradient(circle at 95% 0%, rgba(255,255,255,0.7), rgba(255,255,255,0) 40%)`,
          color: BRAND.ink,
          fontFamily: 'Barlow Condensed',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', alignItems: 'center', gap: 24 * unit }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- immagine generata, non una pagina */}
          <img src={logo} width={story ? 300 : 120} height={story ? 300 : 120} style={{ borderRadius: 999 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: story ? 'center' : 'flex-start' }}>
            <div style={{ display: 'flex', fontSize: 64 * unit + (story ? 0 : 12) }}>{bundle.edition.name}</div>
            <div style={{ display: 'flex', fontSize: 44 * unit + (story ? 0 : 6), letterSpacing: 3 }}>{match.label}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', padding: `${10 * unit + 4}px ${28 * unit + 8}px`, borderRadius: 999, background: BRAND.ink, color: BRAND.white, fontSize: 40 * unit + (story ? 0 : 6), letterSpacing: 3 }}>{status}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 40 * unit, gap: story ? 20 : 40 }}>
            <Team team={match.home} placeholder={match.homePlaceholder} size={story ? 200 : 130} />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: story ? 300 : 190, lineHeight: 1 }}>{scored ? `${match.homeScore}-${match.awayScore}` : 'VS'}</div>
            <Team team={match.away} placeholder={match.awayPlaceholder} size={story ? 200 : 130} />
          </div>
          {match.homePens !== null && match.awayPens !== null ? (
            <div style={{ display: 'flex', marginTop: 16 * unit, fontSize: 48 * unit + (story ? 0 : 6) }}>{`${m.match.afterPens}: ${match.homePens}-${match.awayPens}`}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Inter', textTransform: 'none' }}>
          <div style={{ display: 'flex', fontSize: 34 * unit + (story ? 0 : 6) }}>{when}</div>
          <div style={{ display: 'flex', marginTop: 8, fontFamily: 'Barlow Condensed', textTransform: 'uppercase', fontSize: 40 * unit + (story ? 0 : 6), letterSpacing: 4 }}>{m.brand.claim}</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: 'Barlow Condensed', data: display, weight: 800, style: 'normal' },
        { name: 'Inter', data: text, weight: 600, style: 'normal' },
      ],
    },
  );

  // Con la versione nell'indirizzo l'immagine non cambia più: si può tenere in memoria a lungo.
  image.headers.set('Cache-Control', url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=60');
  if (url.searchParams.has('scarica')) image.headers.set('Content-Disposition', `attachment; filename="smg-partita-${match.id}.png"`);
  return image;
}
