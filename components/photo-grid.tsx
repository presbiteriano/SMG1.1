'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PhotoDTO } from '@/lib/data/dto';
import type { Messages } from '@/lib/i18n';

// Galleria (brief 7.11): caricamento progressivo, apertura a tutto schermo, testo alternativo per ogni foto.
// Qui arrivano solo foto approvate: il controllo è fatto sul server e ripetuto da /media/[id].

const src = (photo: PhotoDTO, width: number) => `/media/${photo.id}?w=${width}`;
const srcSet = (photo: PhotoDTO) => photo.variants.map((width) => `${src(photo, width)} ${width}w`).join(', ');

export function PhotoGrid({ photos, labels }: { photos: PhotoDTO[]; labels: Messages['gallery'] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : photos[index];

  useEffect(() => {
    if (index !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [index]);

  const move = (step: number) => setIndex((value) => (value === null ? null : (value + step + photos.length) % photos.length));

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, position) => (
          <li key={photo.id}>
            <button type="button" onClick={() => setIndex(position)} aria-label={`${labels.open}: ${photo.alt}`} className="group relative block w-full overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- l'immagine passa da /media, che controlla l'approvazione */}
              <img
                src={src(photo, 480)}
                srcSet={srcSet(photo)}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
              {/* Velo celeste uniforme: dà coerenza a foto di qualità diversa (brief 4.6). */}
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-accent opacity-25 mix-blend-multiply" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={current?.alt ?? labels.title}
        onClose={() => setIndex(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') move(1);
          if (event.key === 'ArrowLeft') move(-1);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="on-dark m-0 h-dvh max-h-none w-screen max-w-none bg-inverse p-0 text-on-inverse backdrop:bg-ink"
      >
        {current ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 p-2">
              <p className="kicker px-2 text-xs">
                {(index ?? 0) + 1} / {photos.length}
              </p>
              <button type="button" onClick={() => dialog.current?.close()} aria-label={labels.close} className="grid size-11 place-items-center rounded-full hover:bg-white/15">
                <X aria-hidden className="size-6" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- come sopra */}
              <img src={src(current, 1600)} srcSet={srcSet(current)} sizes="100vw" alt={current.alt} width={current.width} height={current.height} className="max-h-full max-w-full object-contain" />
              {photos.length > 1 ? (
                <>
                  <button type="button" onClick={() => move(-1)} aria-label={labels.previous} className="absolute left-2 grid size-11 place-items-center rounded-full bg-ink/70 hover:bg-ink">
                    <ChevronLeft aria-hidden className="size-6" />
                  </button>
                  <button type="button" onClick={() => move(1)} aria-label={labels.next} className="absolute right-2 grid size-11 place-items-center rounded-full bg-ink/70 hover:bg-ink">
                    <ChevronRight aria-hidden className="size-6" />
                  </button>
                </>
              ) : null}
            </div>
            <div className="p-4 text-sm">
              {current.caption ? <p className="font-semibold">{current.caption}</p> : null}
              {current.credit ? <p className="opacity-80">{labels.credit.replace('{credit}', current.credit)}</p> : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
