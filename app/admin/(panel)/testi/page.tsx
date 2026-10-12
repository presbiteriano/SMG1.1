import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { TextAreaField, TextField } from '@/components/form';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { loadDocument } from '@/lib/data/site-bundle';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { saveDocument } from '../actions';

export const metadata: Metadata = { title: m.admin.documents.title };

// Regolamento (brief 7.12): lo scrive il titolare, non sta nel codice. A ogni salvataggio si aggiorna la data di revisione.
export default async function AdminDocumentsPage() {
  await requirePermission('documents.write');
  const document = await loadDocument(await getDb(), 'regolamento');
  const labels = m.admin.documents;
  return (
    <div className="mx-auto max-w-3xl">
      <AdminTitle title={labels.title} text={document?.revisedAt ? fmt(m.rules.revised, { date: formatRome(document.revisedAt, 'date') }) : undefined} />
      <Panel title={labels.rules}>
        <ActionForm action={saveDocument} submitLabel={m.admin.common.save} className="space-y-4">
          <input type="hidden" name="slug" value="regolamento" />
          <input type="hidden" name="title" value={m.rules.title} />
          <TextAreaField id="body" label={labels.body} help={labels.bodyHelp} rows={18} defaultValue={document?.body ?? ''} />
          <TextField id="fileUrl" label={labels.fileUrl} placeholder="https://" defaultValue={document?.fileUrl ?? ''} />
        </ActionForm>
      </Panel>
    </div>
  );
}
