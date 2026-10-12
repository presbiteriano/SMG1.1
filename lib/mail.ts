import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '@/lib/data/db';

// Email transazionali: link di accesso e avvisi all'organizzatore (brief 12).
// Con EMAIL_API_KEY si usa Resend; senza, il messaggio finisce nel log del server e in
// .data/outbox.log, così in locale si può provare tutto senza inviare nulla.

export type Mail = { to: string; subject: string; text: string };

export function mailIsLive(): boolean {
  return Boolean(process.env.EMAIL_API_KEY);
}

export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    const line = `${new Date().toISOString()}\nA: ${mail.to}\nOggetto: ${mail.subject}\n\n${mail.text}\n${'-'.repeat(60)}\n`;
    try {
      await mkdir(dataDir(), { recursive: true });
      await appendFile(path.join(dataDir(), 'outbox.log'), line, 'utf8');
    } catch {
      // Su un disco in sola lettura resta comunque il log qui sotto.
    }
    console.info(`[smg] email non inviata (manca EMAIL_API_KEY). Oggetto: ${mail.subject}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'SMG Summer Cup <noreply@example.org>',
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!response.ok) throw new Error(`invio email fallito: ${response.status}`);
}

/** Avviso all'organizzatore: non deve mai far fallire l'azione che lo ha generato. */
export async function notifyOrganizer(subject: string, text: string): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) {
    console.info(`[smg] NOTIFY_EMAIL non impostata: avviso non inviato. Oggetto: ${subject}`);
    return;
  }
  try {
    await sendMail({ to, subject, text });
  } catch (error) {
    console.error('[smg] avviso all’organizzatore non inviato', error);
  }
}
