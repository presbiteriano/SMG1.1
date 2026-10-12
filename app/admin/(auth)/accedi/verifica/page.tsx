import type { Metadata } from 'next';
import Link from 'next/link';
import { submitClass } from '@/components/admin/action-form';
import { peekLoginToken } from '@/lib/auth/store';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { confirmLogin } from '../../actions';

// Il link non può essere dedotto dall'indirizzo di provenienza delle pagine successive.
export const metadata: Metadata = { title: m.admin.login.confirmTitle, referrer: 'no-referrer' };

// Il link arrivato per email non fa entrare da solo: serve un tocco. Così i programmi di posta che
// aprono i link in anticipo per controllarli non consumano l'accesso al posto della persona.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const valid = /^[\w-]{20,80}$/.test(token) && (await peekLoginToken(await getDb(), token));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-5 py-10">
      {valid ? (
        <>
          <h1 className="text-5xl">{m.admin.login.confirmTitle}</h1>
          <p className="text-lg">{m.admin.login.confirmText}</p>
          <form action={confirmLogin}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={`${submitClass.primary} w-full`}>
              {m.admin.login.confirm}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-5xl">{m.admin.login.title}</h1>
          <p role="alert" className="text-lg font-semibold">
            {m.admin.login.invalid}
          </p>
          <Link href="/admin/accedi" className={submitClass.outline}>
            {m.admin.login.back}
          </Link>
        </>
      )}
    </main>
  );
}
