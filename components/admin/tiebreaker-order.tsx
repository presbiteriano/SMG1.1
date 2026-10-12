'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';

/** Ordine dei criteri di spareggio: si spostano con le frecce; il primo in alto si applica per primo (brief 11.3). */
export function TiebreakerOrder({ initial, names, moveUp, moveDown }: { initial: string[]; names: Record<string, string>; moveUp: string; moveDown: string }) {
  const [order, setOrder] = useState(initial);
  const move = (index: number, step: number) => {
    const next = [...order];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };
  const button = 'grid size-11 place-items-center rounded-full border border-line disabled:opacity-30';
  return (
    <ol className="divide-y divide-line rounded-xl border border-line">
      {order.map((criterion, index) => (
        <li key={criterion} className="flex items-center gap-3 px-3 py-1.5">
          <input type="hidden" name="tiebreakers" value={criterion} />
          <span className="display w-6 text-xl">{index + 1}</span>
          <span className="flex-1">{names[criterion] ?? criterion}</span>
          <button type="button" className={button} disabled={index === 0} aria-label={moveUp.replace('{name}', names[criterion] ?? criterion)} onClick={() => move(index, -1)}>
            <ArrowUp aria-hidden className="size-5" />
          </button>
          <button type="button" className={button} disabled={index === order.length - 1} aria-label={moveDown.replace('{name}', names[criterion] ?? criterion)} onClick={() => move(index, 1)}>
            <ArrowDown aria-hidden className="size-5" />
          </button>
        </li>
      ))}
    </ol>
  );
}
