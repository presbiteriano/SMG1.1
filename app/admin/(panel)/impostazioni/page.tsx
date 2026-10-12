import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { CheckboxField, TextAreaField, TextField } from '@/components/form';
import { siteSettings } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { parseSiteSettings } from '@/lib/config/site-settings';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { saveSettings } from '../actions';

export const metadata: Metadata = { title: m.admin.settings.title };

// Impostazioni del sito: tutti i punti «da verificare» sui contatti e sulla privacy (brief, sezione 15)
// si compilano qui, non nel codice.
export default async function SettingsPage() {
  await requirePermission('settings.write');
  const [row] = await (await getDb()).select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  const settings = parseSiteSettings(row?.data);
  const labels = m.admin.settings;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminTitle title={labels.title} />
      <ActionForm action={saveSettings} submitLabel={m.admin.common.save} className="space-y-6">
        <Panel title={labels.contacts}>
          <div className="space-y-4">
            <TextAreaField id="phones" label={labels.phones} help={labels.phonesHelp} rows={3} defaultValue={settings.phones.join('\n')} />
            <TextField id="whatsapp_url" label={labels.whatsapp} type="url" placeholder="https://" defaultValue={settings.whatsapp_url ?? ''} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="instagram_url" label={labels.instagram} type="url" defaultValue={settings.instagram_url ?? ''} />
              <TextField id="instagram_handle" label="@" defaultValue={settings.instagram_handle ?? ''} maxLength={60} />
              <TextField id="contact_email" label={labels.contactEmail} type="email" defaultValue={settings.contact_email ?? ''} />
              <TextField id="removal_email" label={labels.removalEmail} type="email" defaultValue={settings.removal_email ?? ''} />
            </div>
            <TextField id="maps_url" label={labels.mapsUrl} type="url" defaultValue={settings.maps_url ?? ''} />
          </div>
        </Panel>

        <Panel title={labels.privacy}>
          <div className="space-y-4">
            <TextField id="controller_name" label={labels.controller} defaultValue={settings.controller_name ?? ''} maxLength={200} />
            <TextField id="consent_form_url" label={labels.consentFormUrl} type="url" placeholder="https://" defaultValue={settings.consent_form_url ?? ''} />
            <CheckboxField id="legal_reviewed" label={labels.legalReviewed} defaultChecked={settings.legal_reviewed}>
              <p className="ml-9 text-sm text-muted">{labels.legalReviewedHelp}</p>
            </CheckboxField>
          </div>
        </Panel>

        <Panel title={labels.sponsor}>
          <CheckboxField id="show_visit_numbers" label={labels.showNumbers} defaultChecked={settings.show_visit_numbers} />
        </Panel>
      </ActionForm>
    </div>
  );
}
