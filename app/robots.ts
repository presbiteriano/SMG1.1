import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

// L'indirizzo del sito si legge all'avvio, non in fase di build.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/offline'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
