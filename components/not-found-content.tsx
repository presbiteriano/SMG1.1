import { m } from '@/lib/i18n';
import { Skyline } from './skyline';
import { ButtonLink } from './ui';

/** 404 con il tono del torneo (brief 4.5). */
export function NotFoundContent() {
  return (
    <div className="container-page py-10">
      <div className="floodlit overflow-hidden rounded-card">
        <div className="px-6 pt-12 pb-6 sm:px-10 sm:pt-16">
          <p className="display text-[7rem] leading-none sm:text-[10rem]" aria-hidden>
            404
          </p>
          <h1 className="mt-2 text-5xl sm:text-6xl">{m.errors.notFoundTitle}</h1>
          <p className="mt-3 text-lg">{m.errors.notFoundText}</p>
          <ButtonLink href="/" className="mt-6">
            {m.errors.notFoundCta}
          </ButtonLink>
        </div>
        <Skyline />
      </div>
    </div>
  );
}
