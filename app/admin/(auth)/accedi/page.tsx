import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { getSessionUser } from '@/lib/auth/session';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.admin.login.title };

// Accesso con link via email: niente password da ricordare o da condividere (brief 9).
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ scaduto?: string }> }) {
  if (await getSessionUser()) redirect('/admin');
  const expired = (await searchParams).scaduto === '1';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="floodlit flex items-center gap-4 rounded-card p-5">
        <Image src="/brand/logo-160.webp" alt={m.brand.logoAlt} width={72} height={72} unoptimized priority className="rounded-full" />
        <div>
          <p className="kicker text-xs">{m.brand.name}</p>
          <h1 className="text-4xl">{m.admin.login.title}</h1>
        </div>
      </div>
      {expired ? (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-semibold">
          {m.admin.login.invalid}
        </p>
      ) : null}
      <p className="text-lg">{m.admin.login.text}</p>
      <LoginForm labels={m.admin.login} />
    </main>
  );
}
