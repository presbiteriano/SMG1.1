import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/not-found-content';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.errors.notFoundTitle, robots: { index: false } };

export default function NotFound() {
  return (
    <main>
      <NotFoundContent />
    </main>
  );
}
