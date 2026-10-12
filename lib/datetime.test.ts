import { describe, expect, it } from 'vitest';
import { daysBetween, formatRome, romeDateKey, romeLocalToUtc, romeTimeKey, shiftDateKey } from './datetime';

describe('fuso orario', () => {
  it('T12 - una partita alle 20:00 di Roma è memorizzata alle 18:00 UTC e si mostra alle 20:00', () => {
    const stored = romeLocalToUtc('2027-06-07', '20:00');
    expect(stored.toISOString()).toBe('2027-06-07T18:00:00.000Z');
    expect(formatRome(stored, 'time')).toBe('20:00');
    expect(romeTimeKey(stored)).toBe('20:00');
    expect(romeDateKey(stored)).toBe('2027-06-07');
  });

  it('d’inverno lo scarto è di un’ora sola', () => {
    expect(romeLocalToUtc('2027-01-15', '20:00').toISOString()).toBe('2027-01-15T19:00:00.000Z');
  });

  it('regge il giorno del cambio dell’ora', () => {
    // 28 marzo 2027: alle 02:00 si passa all'ora legale.
    expect(romeLocalToUtc('2027-03-28', '01:30').toISOString()).toBe('2027-03-28T00:30:00.000Z');
    expect(romeLocalToUtc('2027-03-28', '12:00').toISOString()).toBe('2027-03-28T10:00:00.000Z');
    // 31 ottobre 2027: si torna all'ora solare.
    expect(romeLocalToUtc('2027-10-31', '12:00').toISOString()).toBe('2027-10-31T11:00:00.000Z');
  });

  it('una partita che finisce dopo mezzanotte UTC resta nella serata giusta', () => {
    // 23:30 di Roma del 7 giugno sono le 21:30 UTC; 00:30 di Roma dell'8 sono le 22:30 UTC del 7.
    expect(romeDateKey('2027-06-07T22:30:00Z')).toBe('2027-06-08');
    expect(romeDateKey('2027-06-07T21:30:00Z')).toBe('2027-06-07');
  });

  it('formatta in italiano', () => {
    const at = romeLocalToUtc('2027-06-07', '20:00');
    expect(formatRome(at, 'dayLong')).toBe('lunedì 7 giugno');
    expect(formatRome(at, 'date')).toBe('7 giugno 2027');
  });

  it('sposta e confronta i giorni di calendario', () => {
    expect(shiftDateKey('2027-06-30', 1)).toBe('2027-07-01');
    expect(shiftDateKey('2027-03-01', -1)).toBe('2027-02-28');
    expect(daysBetween('2027-06-07', '2027-06-18')).toBe(11);
  });
});
