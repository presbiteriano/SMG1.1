'use client';

import { useEffect, useState } from 'react';

export type CountdownLabels = { label: string; target: string; days: string; hours: string; minutes: string; seconds: string; done: string };

function parts(target: number, now: number) {
  const left = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(left / 86_400), hours: Math.floor((left % 86_400) / 3_600), minutes: Math.floor((left % 3_600) / 60), seconds: left % 60, over: left === 0 };
}

/**
 * Conto alla rovescia. Al primo disegno mostra i valori calcolati dal server (`initialNow`),
 * così non c'è nessun salto di layout; poi scorre ogni secondo.
 */
export function Countdown({ target, initialNow, labels }: { target: string; initialNow: string; labels: CountdownLabels }) {
  const targetMs = Date.parse(target);
  const [now, setNow] = useState(() => Date.parse(initialNow));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const value = parts(targetMs, now);
  if (value.over) return <p className="display text-4xl">{labels.done}</p>;

  const cells: [number, string][] = [
    [value.days, labels.days],
    [value.hours, labels.hours],
    [value.minutes, labels.minutes],
    [value.seconds, labels.seconds],
  ];
  return (
    <div role="timer" aria-label={`${labels.label} ${value.days} ${labels.days}, ${value.hours} ${labels.hours} ${labels.target}`}>
      <p className="kicker mb-2 text-xs">{labels.label}</p>
      <div className="flex items-end gap-2" aria-hidden>
        {cells.map(([amount, unit]) => (
          <div key={unit} className="min-w-[3.6rem] rounded-xl bg-inverse px-2 py-2 text-center text-on-inverse">
            <span className="display block text-4xl tabular-nums sm:text-5xl">{String(amount).padStart(2, '0')}</span>
            <span className="kicker text-[0.6875rem]">{unit}</span>
          </div>
        ))}
      </div>
      <p className="kicker mt-2 text-xs">{labels.target}</p>
    </div>
  );
}
