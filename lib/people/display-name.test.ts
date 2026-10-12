import { describe, expect, it } from 'vitest';
import example from '@/db/seed/example-edition-2027.json';
import { defaultPublishMode, isNameHidden, publicPersonName, type PersonForDisplay } from './display-name';

const labels = { withNumber: 'Giocatore n. {n}', withoutNumber: 'Giocatore' };

function person(overrides: Partial<PersonForDisplay>): PersonForDisplay {
  return { firstName: 'Lorenzo', lastName: 'Venturelli', isMinor: false, publishNameMode: 'full', consentStatus: 'received', ...overrides };
}

describe('nome pubblico di una persona', () => {
  it('T9 - un minorenne con consenso compare come «Lorenzo V.»', () => {
    const name = publicPersonName(person({ isMinor: true, publishNameMode: 'initial' }), 9, labels);
    expect(name).toEqual({ text: 'Lorenzo V.', hidden: false });
  });

  it('un minorenne senza consenso registrato non compare mai per nome', () => {
    for (const consentStatus of ['pending', 'denied'] as const) {
      for (const publishNameMode of ['full', 'initial', 'hidden'] as const) {
        const name = publicPersonName(person({ isMinor: true, consentStatus, publishNameMode }), 8, labels);
        expect(name).toEqual({ text: 'Giocatore n. 8', hidden: true });
      }
    }
  });

  it('un maggiorenne compare per esteso, salvo scelta diversa', () => {
    expect(publicPersonName(person({ firstName: 'Gianluca', lastName: 'Brunelli' }), 1, labels).text).toBe('Gianluca Brunelli');
    expect(publicPersonName(person({ publishNameMode: 'hidden' }), 5, labels)).toEqual({ text: 'Giocatore n. 5', hidden: true });
    expect(publicPersonName(person({ consentStatus: 'denied' }), null, labels)).toEqual({ text: 'Giocatore', hidden: true });
  });

  it('il titolare può scegliere il nome completo anche per un minorenne con consenso', () => {
    expect(publicPersonName(person({ isMinor: true, publishNameMode: 'full' }), 9, labels).text).toBe('Lorenzo Venturelli');
  });

  it('la forma proposta per i minorenni è «Nome C.»', () => {
    expect(defaultPublishMode(true)).toBe('initial');
    expect(defaultPublishMode(false)).toBe('full');
  });

  it('la rosa di Faro Rovers compare come indicato nel brief (18.2)', () => {
    const shown = example.roster_far.map((entry) =>
      publicPersonName(
        {
          firstName: entry.first_name,
          lastName: entry.last_name,
          isMinor: entry.minor,
          publishNameMode: entry.mode as PersonForDisplay['publishNameMode'],
          consentStatus: entry.consent as PersonForDisplay['consentStatus'],
        },
        entry.number,
        labels,
      ).text,
    );
    expect(shown).toEqual([
      'Gianluca Brunelli',
      'Matteo Santorsi',
      'Davide F.',
      'Nicolò Baldelli',
      'Giocatore n. 5',
      'Simone Gaspari',
      'Federico Corbelli',
      'Andrea M.',
      'Lorenzo V.',
      'Riccardo Sacchetti',
    ]);
  });

  it('isNameHidden è l’unico punto che decide', () => {
    expect(isNameHidden(person({ isMinor: true, consentStatus: 'pending' }))).toBe(true);
    expect(isNameHidden(person({ isMinor: false, consentStatus: 'pending' }))).toBe(false);
  });
});
