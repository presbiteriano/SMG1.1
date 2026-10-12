'use client';

import { useActionState } from 'react';
import { updatePhoto } from '@/app/admin/(panel)/foto/actions';
import { CheckboxField, inputClass } from '@/components/form';
import type { Messages } from '@/lib/i18n';
import { StateMessage, submitClass } from './action-form';

export type EditablePhoto = { id: number; alt: string; caption: string; credit: string; containsMinors: boolean; consentPublish: boolean; state: 'draft' | 'approved' | 'rejected' };

/**
 * Scheda di una foto nel pannello. I pulsanti inviano lo stesso modulo con un'intenzione diversa:
 * salva, approva e pubblica, riporta in bozza, respingi. Il controllo sulle liberatorie è sul server.
 */
export function PhotoEditor({ photo, canApprove, labels, saveLabel }: { photo: EditablePhoto; canApprove: boolean; labels: Messages['admin']['photos']; saveLabel: string }) {
  const [state, action, pending] = useActionState(updatePhoto, { status: 'idle' });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={photo.id} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{labels.alt}</span>
        <input name="alt" defaultValue={photo.alt} maxLength={200} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{labels.caption}</span>
          <input name="caption" defaultValue={photo.caption} maxLength={200} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{labels.credit}</span>
          <input name="credit" defaultValue={photo.credit} maxLength={120} className={inputClass} />
        </label>
      </div>
      <CheckboxField id={`minors-${photo.id}`} name="containsMinors" label={labels.containsMinors} defaultChecked={photo.containsMinors} />
      <CheckboxField id={`consent-${photo.id}`} name="consentPublish" label={labels.consentPublish} defaultChecked={photo.consentPublish} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="save" disabled={pending} className={submitClass.quiet}>
          {saveLabel}
        </button>
        {canApprove && photo.state !== 'approved' ? (
          <button type="submit" name="intent" value="approve" disabled={pending} className={`${submitClass.primary} min-h-11 px-4 text-base`}>
            {labels.approve}
          </button>
        ) : null}
        {canApprove && photo.state === 'approved' ? (
          <button type="submit" name="intent" value="unpublish" disabled={pending} className={submitClass.quiet}>
            {labels.unpublish}
          </button>
        ) : null}
        {canApprove && photo.state !== 'rejected' ? (
          <button type="submit" name="intent" value="reject" disabled={pending} className={submitClass.quiet}>
            {labels.reject}
          </button>
        ) : null}
      </div>
      <StateMessage state={state} />
    </form>
  );
}
