import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { m } from '@/lib/i18n';

// Pannello di gestione: protetto e fuori dai motori di ricerca (brief 6).
export const metadata: Metadata = {
  title: { default: m.admin.title, template: `%s · ${m.admin.title}` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
