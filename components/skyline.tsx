import { cx } from '@/lib/ui';

/**
 * Linea d'orizzonte con grattacielo, vele, ponte e faro: riprende il motivo del logo come divisore
 * tra sezioni (brief 4.6, proposta). È un tratto semplice e decorativo, non un ridisegno del logo:
 * il titolare lo deve approvare; per toglierlo basta rimuovere questo componente dove è usato.
 */
export function Skyline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 44" preserveAspectRatio="xMidYMax meet" aria-hidden focusable="false" className={cx('block h-9 w-full', className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 40h480" />
      {/* grattacielo */}
      <path d="M70 40V10h14v30M73 10V5h8v5M75 16v20M79 16v20" />
      {/* due vele */}
      <path d="M150 34l14-22v22zM164 14v20M146 36h26l-3 4h-20z" />
      <path d="M186 36l10-15v15zM196 22v14M183 37h19l-2 3h-15z" />
      {/* ponte */}
      <path d="M250 40q14-14 28 0M278 40q14-14 28 0M306 40q14-14 28 0" />
      {/* faro */}
      <path d="M392 40l2-20h8l2 20M393 20v-5h10v5M393 15l5-5 5 5M395 28h6" />
      {/* gabbiani */}
      <path d="M352 12q3-4 6 0q3-4 6 0M424 8q2-3 4 0q2-3 4 0" />
    </svg>
  );
}
