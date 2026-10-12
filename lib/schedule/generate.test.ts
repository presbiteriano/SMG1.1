import { describe, expect, it } from 'vitest';
import { assignSlots, knockoutPlan, roundRobin, snakeGroups, type KnockoutSource } from './generate';

const show = (source: KnockoutSource) => (source.kind === 'group' ? `${'ABCDEFGH'[source.group]}${source.rank}` : `V:${source.stage}:${source.slot}`);

describe('generatore di calendario', () => {
  it('girone da quattro: sei partite in tre giornate, tutti contro tutti una volta', () => {
    const matches = roundRobin(['FAR', 'GAB', 'DAR', 'SCO']);
    expect(matches).toHaveLength(6);
    expect(new Set(matches.map((match) => match.round))).toEqual(new Set([1, 2, 3]));
    const pairs = new Set(matches.map((match) => [match.home, match.away].sort().join('-')));
    expect(pairs.size).toBe(6);
    for (const round of [1, 2, 3]) {
      const playing = matches.filter((match) => match.round === round).flatMap((match) => [match.home, match.away]);
      expect(new Set(playing).size).toBe(4); // nessuno gioca due volte nella stessa giornata
    }
  });

  it('con squadre dispari a turno una riposa', () => {
    const matches = roundRobin(['A', 'B', 'C']);
    expect(matches).toHaveLength(3);
    expect(new Set(matches.map((match) => match.round)).size).toBe(3);
  });

  it('quattro gironi e due qualificate: gli incroci del brief (18.5)', () => {
    const plan = knockoutPlan(4, 2);
    const quarters = plan!.filter((match) => match.stage === 'quarter').map((match) => `${show(match.home)}-${show(match.away)}`);
    expect(quarters).toEqual(['A1-B2', 'B1-A2', 'C1-D2', 'D1-C2']);
    const semis = plan!.filter((match) => match.stage === 'semi').map((match) => `${show(match.home)}-${show(match.away)}`);
    expect(semis).toEqual(['V:quarter:1-V:quarter:3', 'V:quarter:2-V:quarter:4']);
    expect(plan!.filter((match) => match.stage === 'final').map((match) => `${show(match.home)}-${show(match.away)}`)).toEqual(['V:semi:1-V:semi:2']);
    expect(plan).toHaveLength(7);
  });

  it('due gironi e due qualificate: semifinali incrociate e finale', () => {
    const plan = knockoutPlan(2, 2);
    expect(plan!.map((match) => `${match.stage} ${show(match.home)}-${show(match.away)}`)).toEqual(['semi A1-B2', 'semi B1-A2', 'final V:semi:1-V:semi:2']);
  });

  it('otto gironi: due squadre dello stesso girone si ritrovano solo in finale', () => {
    const plan = knockoutPlan(8, 2)!;
    expect(plan.filter((match) => match.stage === 'round_of_16')).toHaveLength(8);
    const quarters = plan.filter((match) => match.stage === 'quarter').map((match) => `${show(match.home)}-${show(match.away)}`);
    expect(quarters).toEqual(['V:round_of_16:1-V:round_of_16:3', 'V:round_of_16:5-V:round_of_16:7', 'V:round_of_16:2-V:round_of_16:4', 'V:round_of_16:6-V:round_of_16:8']);
  });

  it('se la combinazione non dà un tabellone pieno, si crea a mano', () => {
    expect(knockoutPlan(3, 2)).toBeNull();
    expect(knockoutPlan(4, 3)).toBeNull();
    expect(knockoutPlan(4, 1)?.map((match) => `${match.stage} ${show(match.home)}-${show(match.away)}`)).toEqual(['semi A1-D1', 'semi B1-C1', 'final V:semi:1-V:semi:2']);
  });

  it('riempie le serate uno slot dopo l’altro; finite le serate, l’orario resta da definire', () => {
    const placed = assignSlots([{ n: 1 }, { n: 2 }, { n: 3 }], ['2027-06-07'], ['20:00', '20:45']);
    expect(placed).toEqual([
      { n: 1, date: '2027-06-07', time: '20:00' },
      { n: 2, date: '2027-06-07', time: '20:45' },
      { n: 3, date: null, time: null },
    ]);
  });

  it('distribuisce le squadre nei gironi a serpentina', () => {
    expect(snakeGroups([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });
});
