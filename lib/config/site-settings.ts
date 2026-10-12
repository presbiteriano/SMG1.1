import { z } from 'zod';
import defaults from './site-defaults.json';

// Impostazioni del sito modificabili dal pannello: contatti, collegamenti, titolare del trattamento.
// Sono tutti punti «da verificare» del brief: nessuno è scritto nel codice.

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https:\/\/[^\s]+$/i.test(value), { message: 'url' })
  .transform((value) => (value === '' ? null : value))
  .nullable();

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), { message: 'email' })
  .transform((value) => (value === '' ? null : value))
  .nullable();

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const siteSettingsSchema = z.object({
  instagram_url: optionalUrl,
  instagram_handle: optionalText,
  whatsapp_url: optionalUrl,
  phones: z.array(z.string().trim().min(5).max(20)).max(6),
  contact_email: optionalEmail,
  removal_email: optionalEmail,
  maps_url: optionalUrl,
  controller_name: optionalText,
  legal_reviewed: z.boolean(),
  consent_form_url: optionalUrl,
  show_visit_numbers: z.boolean(),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const { _nota: _ignored, ...defaultValues } = defaults;
void _ignored;

export const DEFAULT_SITE_SETTINGS: SiteSettings = siteSettingsSchema.parse(defaultValues);

/** Unisce ciò che è salvato ai valori di partenza; un dato rotto non spegne il sito. */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const merged = { ...DEFAULT_SITE_SETTINGS, ...(typeof raw === 'object' && raw !== null ? raw : {}) };
  const parsed = siteSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS;
}

/** Numero pronto per un collegamento tel: (solo cifre e +). */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
