'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { registrations, removalRequests } from '@/db/schema';
import { REMOVAL_SUBJECTS } from '@/db/schema/enums';
import { recordEvent } from '@/lib/data/analytics';
import { getDb } from '@/lib/data/db';
import { getEdition, getSite } from '@/lib/data/queries';
import { siteUrl } from '@/lib/env';
import { fmt, m } from '@/lib/i18n';
import { notifyOrganizer } from '@/lib/mail';
import { clientKeyFrom, rateLimit } from '@/lib/rate-limit';
import { registrationState } from '@/lib/site';

// Moduli pubblici: iscrizione di una squadra e richiesta di rimozione di un contenuto.
// Ogni ingresso è validato sul server; senza consenso non si salva nulla (brief 7.9).

export type FormState = {
  status: 'idle' | 'ok' | 'error';
  errors: Record<string, string>;
  values: Record<string, string>;
};

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const HOUR = 60 * 60 * 1000;

const registrationSchema = z.object({
  teamName: z.string().min(2).max(80),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().regex(/^\+?[\d\s./-]{6,20}$/),
  email: z.string().email().max(200),
  playersCount: z.union([z.literal(''), z.string().regex(/^\d{1,2}$/)]),
  kitColor: z.string().max(40),
  notes: z.string().max(600),
});

const REGISTRATION_FIELDS = ['teamName', 'firstName', 'lastName', 'phone', 'email', 'playersCount', 'kitColor', 'notes', 'hasMinors'] as const;

export async function submitRegistration(_previous: FormState, data: FormData): Promise<FormState> {
  const values = Object.fromEntries(REGISTRATION_FIELDS.map((key) => [key, text(data, key)]));
  const fail = (errors: Record<string, string>): FormState => ({ status: 'error', errors, values });

  // Campo esca compilato: è un robot. Si risponde come se fosse andata bene, senza salvare nulla.
  if (text(data, 'website') !== '') return { status: 'ok', errors: {}, values: {} };

  if (!rateLimit('registration', clientKeyFrom(await headers()), 5, HOUR)) return fail({ form: m.registration.errors.rate });

  const { data: site } = await getSite();
  const edition = site.featuredYear ? (await getEdition(site.featuredYear)).data?.edition : null;
  if (!edition || registrationState(edition, new Date()) !== 'open') return fail({ form: m.registration.errors.closed });

  const errors: Record<string, string> = {};
  const parsed = registrationSchema.safeParse(values);
  if (!parsed.success) {
    const messages = m.registration.errors;
    const byField: Record<string, string> = { teamName: messages.teamName, firstName: messages.firstName, lastName: messages.lastName, phone: messages.phone, email: messages.email, playersCount: messages.playersCount, kitColor: messages.tooLong, notes: messages.tooLong };
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      errors[key] ??= byField[key] ?? messages.generic;
    }
  }
  const players = values.playersCount === '' ? null : Number(values.playersCount);
  if (players !== null && (players < 1 || players > 40)) errors.playersCount = m.registration.errors.playersCount;
  if (data.get('consentRules') !== 'on') errors.consentRules = m.registration.errors.consentRules;
  if (data.get('consentPrivacy') !== 'on') errors.consentPrivacy = m.registration.errors.consentPrivacy;
  if (Object.keys(errors).length > 0 || !parsed.success) return fail({ ...errors, form: m.registration.errors.summary });

  try {
    const db = await getDb();
    const now = new Date();
    await db.insert(registrations).values({
      editionId: edition.id,
      teamName: parsed.data.teamName,
      contactName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      contactPhone: parsed.data.phone,
      contactEmail: parsed.data.email.toLowerCase(),
      playersCount: players,
      kitColor: parsed.data.kitColor || null,
      hasMinors: data.get('hasMinors') === 'on',
      notes: parsed.data.notes || null,
      consentPrivacyAt: now,
      consentRulesAt: now,
      status: 'new',
      source: 'public',
    });
    await recordEvent(db, { event: 'registration' });
  } catch (error) {
    console.error('[smg] iscrizione non salvata', error);
    return fail({ form: m.registration.errors.generic });
  }

  // L'avviso contiene solo il nome della squadra: i contatti si leggono nel pannello, non nella posta.
  await notifyOrganizer(
    fmt(m.email.registrationSubject, { team: parsed.data.teamName }),
    fmt(m.email.registrationBody, { team: parsed.data.teamName, edition: edition.name, link: `${siteUrl()}/admin/iscrizioni` }),
  );
  return { status: 'ok', errors: {}, values: {} };
}

const removalSchema = z.object({
  subject: z.enum(REMOVAL_SUBJECTS),
  reference: z.string().min(5).max(500),
  role: z.enum(['self', 'parent', 'other']),
  email: z.string().email().max(200),
  message: z.string().max(1000),
});

export async function submitRemoval(_previous: FormState, data: FormData): Promise<FormState> {
  const values = Object.fromEntries(['subject', 'reference', 'role', 'email', 'message'].map((key) => [key, text(data, key)]));
  const fail = (errors: Record<string, string>): FormState => ({ status: 'error', errors, values });
  const messages = m.legal.removal.errors;

  if (text(data, 'website') !== '') return { status: 'ok', errors: {}, values: {} };
  if (!rateLimit('removal', clientKeyFrom(await headers()), 5, HOUR)) return fail({ form: messages.rate });

  const errors: Record<string, string> = {};
  const parsed = removalSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      errors[key] ??= key === 'email' ? messages.email : key === 'reference' ? messages.reference : messages.generic;
    }
  }
  if (data.get('consent') !== 'on') errors.consent = messages.consent;
  if (!parsed.success || Object.keys(errors).length > 0) return fail(errors);

  try {
    const db = await getDb();
    await db.insert(removalRequests).values({
      subject: parsed.data.subject,
      reference: parsed.data.reference,
      requesterRole: parsed.data.role,
      contactEmail: parsed.data.email.toLowerCase(),
      message: parsed.data.message || null,
      source: 'public',
    });
  } catch (error) {
    console.error('[smg] richiesta di rimozione non salvata', error);
    return fail({ form: messages.generic });
  }

  await notifyOrganizer(m.email.removalSubject, fmt(m.email.removalBody, { subject: m.legal.removal.subjects[parsed.data.subject], link: `${siteUrl()}/admin/richieste` }));
  return { status: 'ok', errors: {}, values: {} };
}
