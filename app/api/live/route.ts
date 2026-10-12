import { getEdition } from '@/lib/data/queries';
import { editionStamp, parseYear } from '@/lib/site';

// Il browser chiede qui, ogni 30 secondi durante le partite, se i dati di gara sono cambiati (brief 8).
// La risposta arriva dalla cache: nessun peso sul database.
export async function GET(request: Request) {
  const year = parseYear(new URL(request.url).searchParams.get('anno') ?? undefined);
  if (!year) return Response.json({ stamp: 'none' }, { status: 400 });
  const { data } = await getEdition(year);
  return Response.json({ stamp: editionStamp(data) }, { headers: { 'Cache-Control': 'no-store' } });
}
