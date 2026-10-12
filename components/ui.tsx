import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/ui';

// Mattoni dell'interfaccia. Tutti i bersagli di tocco sono alti almeno 44 px (brief 13.2).

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-display text-lg font-bold uppercase tracking-wide transition-transform duration-150 active:scale-[0.98] disabled:opacity-50';

const BUTTON_VARIANTS = {
  /** Azione principale: nero con testo bianco. */
  primary: 'bg-inverse text-on-inverse on-dark hover:opacity-90',
  /** Su fondo nero: celeste con testo nero. */
  accent: 'bg-accent text-on-accent hover:brightness-95',
  outline: 'border-2 border-ink text-text hover:bg-surface-2',
  ghost: 'text-text underline decoration-2 underline-offset-4 hover:bg-surface-2',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant = 'primary', extra?: string): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], extra);
}

export function ButtonLink({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

/** Etichetta di categoria sopra un titolo. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('kicker', className)}>{children}</p>;
}

export function Pill({ children, tone = 'soft', className }: { children: ReactNode; tone?: 'soft' | 'ink' | 'sky' | 'outline'; className?: string }) {
  const tones = {
    soft: 'bg-surface-2 text-text',
    ink: 'bg-inverse text-on-inverse',
    sky: 'bg-accent text-on-accent',
    outline: 'border border-ink text-text',
  };
  return <span className={cx('kicker inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', tones[tone], className)}>{children}</span>;
}

/** Apertura di una pagina: ogni pagina risponde a una domanda (brief 6). */
export function PageHeader({
  kicker,
  title,
  question,
  children,
  compact = false,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  question?: ReactNode;
  children?: ReactNode;
  /** Dentro l'hub di un'edizione il titolo è più piccolo: su telefono i risultati devono stare in alto. */
  compact?: boolean;
}) {
  return (
    <header className={cx('container-page', compact ? 'pt-5 pb-4 sm:pt-8' : 'pt-8 pb-6 sm:pt-12')}>
      {kicker ? <Kicker className="mb-2 text-link">{kicker}</Kicker> : null}
      <h1 className={compact ? 'text-3xl sm:text-5xl' : 'text-5xl sm:text-6xl'}>{title}</h1>
      {question ? <p className={cx('max-w-2xl text-muted', compact ? 'mt-1.5' : 'mt-3 text-lg')}>{question}</p> : null}
      {children ? <div className={compact ? 'mt-3' : 'mt-5'}>{children}</div> : null}
    </header>
  );
}

export function SectionHeading({ title, action, id }: { title: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="flex items-center gap-2.5 text-3xl">
        <span aria-hidden className="inline-block h-6 w-2 rounded-sm bg-accent" />
        {title}
      </h2>
      {action ? <div className="shrink-0 pb-0.5 text-sm font-semibold">{action}</div> : null}
    </div>
  );
}

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cx('inline-flex min-h-11 items-center font-semibold text-link underline', className)} {...props} />;
}

/** Stato vuoto curato: mai una tabella vuota (brief 7.1). */
export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 border-dashed p-6 shadow-none">
      <p className="display text-2xl">{title}</p>
      {children ? <div className="text-muted">{children}</div> : null}
      {action}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
