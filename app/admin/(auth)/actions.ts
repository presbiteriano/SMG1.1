'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { failed, ok, text, type ActionState } from '@/lib/admin/action';
import { endSession, startSession } from '@/lib/auth/session';
import { consumeLoginToken, issueLoginToken } from '@/lib/auth/store';
import { getDb } from '@/lib/data/db';
import { siteUrl } from '@/lib/env';
import { fmt, m } from '@/lib/i18n';
import { mailIsLive, sendMail } from '@/lib/mail';
import { clientKeyFrom, rateLimit } from '@/lib/rate-limit';

const QUARTER = 15 * 60 * 1000;

/** Manda il link di accesso. La risposta è la stessa per ogni indirizzo: non si capisce chi è abilitato. */
export async function requestLoginLink(_previous: ActionState, data: FormData): Promise<ActionState> {
  const email = text(data, 'email');
  if (!rateLimit('login', clientKeyFrom(await headers()), 6, QUARTER)) return failed(m.admin.login.rate);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok(m.admin.login.sent);

  const issued = await issueLoginToken(await getDb(), email);
  if (!issued) return ok(m.admin.login.sent);

  const link = `${siteUrl()}/admin/accedi/verifica?token=${issued.token}`;
  try {
    await sendMail({ to: issued.user.email, subject: m.email.loginSubject, text: fmt(m.email.loginBody, { name: issued.user.name, link }) });
  } catch (error) {
    console.error('[smg] link di accesso non inviato', error);
  }
  // Solo in sviluppo, quando non c'è un servizio di posta: il link compare a schermo per poter provare.
  const showLink = process.env.NODE_ENV === 'development' && !mailIsLive();
  return ok(m.admin.login.sent, showLink ? { devLink: link } : undefined);
}

export async function confirmLogin(data: FormData): Promise<void> {
  const user = await consumeLoginToken(await getDb(), text(data, 'token'));
  if (!user) redirect('/admin/accedi?scaduto=1');
  await startSession(user.id);
  redirect('/admin');
}

export async function logout(): Promise<void> {
  await endSession();
  redirect('/admin/accedi');
}
