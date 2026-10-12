import { z } from 'zod';

// Regole del torneo per edizione (brief 1 e 11.3): quando il titolare risponde si cambia un valore
// nel pannello, non il programma. I valori qui sotto sono quelli di partenza del brief (sezione 15).

export const TIEBREAKERS = [
  'points',
  'head_to_head_points',
  'head_to_head_goal_diff',
  'goal_diff',
  'goals_for',
  'fair_play',
  'draw_lot',
] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];

const count = (max: number) => z.number().int().min(0).max(max);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const editionConfigSchema = z.object({
  points: z.object({ win: count(10), draw: count(10), loss: count(10) }),
  tiebreakers: z.array(z.enum(TIEBREAKERS)).min(1),
  groups: z.number().int().min(1).max(16),
  qualify_per_group: z.number().int().min(1).max(8),
  knockout_tie: z.enum(['penalties']),
  fair_play: z.object({ yellow: count(10), red: count(10) }),
  forfeit: z.object({
    winner_score: count(20),
    loser_score: count(20),
    // T8: a tavolino i gol contano per la classifica ma non per i marcatori.
    goals_count_for_scorers: z.boolean(),
  }),
  schedule: z.object({
    slot_times: z.array(hhmm).min(1),
    match_minutes: z.number().int().min(5).max(180),
  }),
  format: z.object({
    players_on_field: z.number().int().min(3).max(11).nullable(),
    halves: z.number().int().min(1).max(4).nullable(),
    half_minutes: z.number().int().min(1).max(60).nullable(),
  }),
  roster: z.object({ min: count(40), max: count(40) }),
  registration: z.object({
    capacity: z.number().int().min(0).max(128).nullable(),
    fee_text: z.string().max(300),
    payment_text: z.string().max(600),
  }),
  features: z.object({
    stats: z.boolean(),
    rosters: z.boolean(),
    third_place: z.boolean(),
  }),
  links: z.object({ tuttocampo_url: z.string().url().nullable() }),
});

export type EditionConfig = z.infer<typeof editionConfigSchema>;

export const DEFAULT_EDITION_CONFIG: EditionConfig = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'head_to_head_points', 'head_to_head_goal_diff', 'goal_diff', 'goals_for', 'fair_play', 'draw_lot'],
  groups: 4,
  qualify_per_group: 2,
  knockout_tie: 'penalties',
  fair_play: { yellow: 1, red: 3 },
  forfeit: { winner_score: 3, loser_score: 0, goals_count_for_scorers: false },
  schedule: { slot_times: ['20:00', '20:45', '21:30', '22:15'], match_minutes: 45 },
  format: { players_on_field: null, halves: null, half_minutes: null },
  roster: { min: 0, max: 40 },
  registration: { capacity: null, fee_text: '', payment_text: '' },
  features: { stats: true, rosters: true, third_place: false },
  links: { tuttocampo_url: null },
};

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep(base: Plain, override: Plain): Plain {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = isPlain(current) && isPlain(value) ? mergeDeep(current, value) : value;
  }
  return out;
}

/** Completa con i valori di partenza ciò che l'edizione non specifica e valida il risultato. */
export function parseEditionConfig(raw: unknown): EditionConfig {
  const merged = mergeDeep(DEFAULT_EDITION_CONFIG as unknown as Plain, isPlain(raw) ? raw : {});
  return editionConfigSchema.parse(merged);
}

/** Come parseEditionConfig, ma non lancia: una configurazione rotta non deve spegnere il sito pubblico. */
export function safeEditionConfig(raw: unknown): EditionConfig {
  try {
    return parseEditionConfig(raw);
  } catch {
    return DEFAULT_EDITION_CONFIG;
  }
}
