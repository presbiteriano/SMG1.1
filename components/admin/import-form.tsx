'use client';

import { useActionState, useState } from 'react';
import { importCsv } from '@/app/admin/(panel)/importa/actions';
import { inputClass } from '@/components/form';
import type { Messages } from '@/lib/i18n';
import { StateMessage, submitClass } from './action-form';

/** Importazione CSV in due passi (brief 9): l'anteprima non scrive nulla, la conferma importa. */
export function ImportForm({ editionId, labels, headers }: { editionId: number; labels: Messages['admin']['import']; headers: string[] }) {
  const [state, action, pending] = useActionState(importCsv, { status: 'idle' });
  // Il testo resta nel campo dopo l'anteprima: serve identico per la conferma.
  const [csv, setCsv] = useState('');
  const ready = Number(state.extra?.ready ?? 0);
  const preview: (string | number)[][] = state.extra?.preview ? JSON.parse(state.extra.preview) : [];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="editionId" value={editionId} />
      <label className="block">
        <span className="mb-1.5 block font-semibold">{labels.paste}</span>
        <textarea name="csv" rows={10} required value={csv} onChange={(event) => setCsv(event.target.value)} className={`${inputClass} py-3 font-mono text-sm`} spellCheck={false} />
        <span className="mt-1.5 block text-sm text-muted">{labels.columns}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="preview" disabled={pending} className={submitClass.outline}>
          {labels.preview}
        </button>
        {ready > 0 ? (
          <button type="submit" name="intent" value="confirm" disabled={pending} className={submitClass.primary}>
            {labels.confirm.replace('{n}', String(ready))}
          </button>
        ) : null}
      </div>
      <StateMessage state={state} />
      {state.warnings && state.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {preview.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{labels.preview}</caption>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col" className="kicker border-b border-line px-2 py-2 text-xs text-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, index) => (
                    <td key={index} className="border-b border-line px-2 py-1.5 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}
