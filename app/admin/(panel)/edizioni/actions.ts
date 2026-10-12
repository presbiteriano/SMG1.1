'use server';

import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { editions } from '@/db/schema';
import { EDITION_STATUSES, type EditionStatus } from '@/db/schema/enums';
import { authorize, checked, failed, integer, ok, optional, text, type ActionState } from '@/lib/admin/action';
import { editionConfigSchema, safeEditionConfig, TIEBREAKERS, type Tiebreaker } from '@/lib/config/edition-config';
import { writeAudit } from '@/lib/data/audit';
import { invalidate, tags } from '@/lib/data/invalidate';
import { advanceBracket } from '@/lib/data/results-provider';
import { romeLocalToUtc } from '@/lib/datetime';
import { m } from '@/lib/i18n';

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Nuova edizione in bozza, con le regole dell'ultima (brief 14.4): poi si cambiano date, regole e squadre. */
export async function createEdition(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('editions.write');
  if ('denied' in auth) return auth.denied;
  const year = integer(data, 'year');
  const name = text(data, 'name');
  if (year === null || year < 2000 || year > 2100 || name.length < 3) return failed(m.admin.editions.errors.year);
  const [taken] = await auth.db.select({ id: editions.id }).from(editions).where(eq(editions.year, year)).limit(1);
  if (taken) return failed(m.admin.editions.errors.year);
  const [latest] = await auth.db.select().from(editions).orderBy(desc(editions.year)).limit(1);
  const [created] = await auth.db
    .insert(editions)
    .values({ year, name, status: 'draft', venueId: latest?.venueId ?? null, config: latest?.config ?? {} })
    .returning();
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'edition', entityId: created.id, action: 'create', after: { year, name } });
  redirect(`/admin/edizioni/${created.id}`);
}

/** Stato, date e regole dell'edizione: è qui che si cambia un valore invece del programma (brief 1). */
export async function saveEdition(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('editions.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const [before] = id === null ? [] : await auth.db.select().from(editions).where(eq(editions.id, id)).limit(1);
  if (!before) return failed();

  const current = safeEditionConfig(before.config);
  const number = (key: string, fallback: number) => integer(data, key) ?? fallback;
  const nullable = (key: string) => integer(data, key);
  const chosen = data.getAll('tiebreakers').map(String).filter((value): value is Tiebreaker => (TIEBREAKERS as readonly string[]).includes(value));
  const tuttocampo = optional(data, 'tuttocampoUrl');

  const parsed = editionConfigSchema.safeParse({
    ...current,
    points: { win: number('pointsWin', current.points.win), draw: number('pointsDraw', current.points.draw), loss: number('pointsLoss', current.points.loss) },
    // I punti sono sempre il primo criterio; gli altri seguono nell'ordine scelto.
    tiebreakers: chosen.length > 0 ? [...new Set<Tiebreaker>(['points', ...chosen])] : current.tiebreakers,
    groups: number('groups', current.groups),
    qualify_per_group: number('qualify', current.qualify_per_group),
    fair_play: { yellow: number('fairYellow', current.fair_play.yellow), red: number('fairRed', current.fair_play.red) },
    forfeit: { ...current.forfeit, winner_score: number('forfeitWin', current.forfeit.winner_score), loser_score: number('forfeitLoss', current.forfeit.loser_score) },
    schedule: {
      slot_times: text(data, 'slotTimes')
        .split(/[\s,;]+/)
        .filter(Boolean),
      match_minutes: number('matchMinutes', current.schedule.match_minutes),
    },
    format: { players_on_field: nullable('playersOnField'), halves: nullable('halves'), half_minutes: nullable('halfMinutes') },
    registration: { capacity: nullable('capacity'), fee_text: text(data, 'feeText'), payment_text: text(data, 'paymentText') },
    features: { ...current.features, stats: checked(data, 'featureStats'), rosters: checked(data, 'featureRosters') },
    // Solo un collegamento: il sito non legge né copia dati da TuttoCampo.
    links: { tuttocampo_url: tuttocampo },
  });
  if (!parsed.success) return failed(m.admin.editions.errors.config);

  const status = (EDITION_STATUSES as readonly string[]).includes(text(data, 'status')) ? (text(data, 'status') as EditionStatus) : before.status;
  const start = text(data, 'startDate');
  const end = text(data, 'endDate');
  const open = text(data, 'registrationOpen');
  const close = text(data, 'registrationClose');
  const rulesUrl = optional(data, 'rulesUrl');

  await auth.db
    .update(editions)
    .set({
      name: text(data, 'name') || before.name,
      status,
      startDate: isDate(start) ? start : null,
      endDate: isDate(end) ? end : null,
      registrationOpenAt: isDate(open) ? romeLocalToUtc(open, '00:00') : null,
      registrationCloseAt: isDate(close) ? romeLocalToUtc(close, '23:59') : null,
      rulesUrl: rulesUrl && /^(https:\/\/|\/)/i.test(rulesUrl) ? rulesUrl : null,
      config: parsed.data,
    })
    .where(eq(editions.id, before.id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'edition', entityId: before.id, action: 'update', before: { status: before.status, config: before.config }, after: { status, config: parsed.data } });
  // Cambiando punti o criteri può cambiare chi passa il turno.
  await advanceBracket(auth.db, before.id, { userId: auth.user.id }, 'admin');
  invalidate(tags.edition(before.year), tags.site());
  return ok(m.admin.editions.saved);
}
