'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { uploadPhoto } from '@/app/admin/(panel)/foto/actions';
import { CheckboxField, inputClass } from '@/components/form';
import type { Messages } from '@/lib/i18n';
import { submitClass } from './action-form';

type Preview = { name: string; url: string };

/**
 * Caricamento multiplo con anteprima (brief 9). Le foto partono una alla volta e restano in bozza:
 * diventano pubbliche solo dopo l'approvazione.
 */
export function PhotoUploader({ editionId, labels, creditLabel }: { editionId: number | null; labels: Messages['admin']['photos']; creditLabel: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [minors, setMinors] = useState(false);
  const [credit, setCredit] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState('');

  const choose = (list: FileList | null) => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    const chosen = list ? [...list] : [];
    setFiles(chosen);
    setPreviews(chosen.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
    setMessage('');
  };

  const upload = async () => {
    let uploaded = 0;
    let lastError = '';
    setProgress({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      const data = new FormData();
      data.set('file', file);
      if (editionId !== null) data.set('editionId', String(editionId));
      if (minors) data.set('containsMinors', 'on');
      if (credit) data.set('credit', credit);
      const result = await uploadPhoto({ status: 'idle' }, data);
      if (result.status === 'ok') uploaded += 1;
      else lastError = `${file.name}: ${result.message ?? ''}`;
      setProgress({ done: index + 1, total: files.length });
    }
    setProgress(null);
    choose(null);
    setMessage([labels.uploaded.replace('{n}', String(uploaded)), lastError].filter(Boolean).join(' '));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-semibold">{labels.upload}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => choose(event.target.files)} className="block w-full text-sm" />
        <span className="mt-1 block text-sm text-muted">{labels.uploadHelp}</span>
      </label>

      {previews.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((preview) => (
            <li key={preview.url}>
              {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale, il file non è ancora sul server */}
              <img src={preview.url} alt={preview.name} className="aspect-square w-full rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      <CheckboxField id="upload-minors" label={labels.containsMinors} checked={minors} onChange={(event) => setMinors(event.target.checked)} />
      <label className="block">
        <span className="mb-1.5 block font-semibold">{creditLabel}</span>
        <input value={credit} onChange={(event) => setCredit(event.target.value)} maxLength={120} className={inputClass} />
      </label>

      <button type="button" onClick={upload} disabled={files.length === 0 || progress !== null} className={submitClass.primary}>
        {progress ? labels.uploading.replace('{done}', String(progress.done)).replace('{total}', String(progress.total)) : labels.upload}
      </button>
      <p role="status" className="font-semibold">
        {message}
      </p>
    </div>
  );
}
