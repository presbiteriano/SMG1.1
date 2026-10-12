import { describe, expect, it } from 'vitest';
import example from '@/db/seed/example-edition-2027.json';
import { DEFAULT_EDITION_CONFIG, parseEditionConfig } from '@/lib/config/edition-config';
import { computeStandings, type StandingsMatch } from './compute';
import { matchWinner } from './knockout';

// Test di accettazione del brief (16.9) sui risultati attesi dell'edizione di esempio (sezione 18).

const rules = parseEditionConfig(example.edition.config);

function groupTeams(group: string): string[] {
  return example.teams.filter((team) => team.group === group).map((team) => team.code);
}

function groupMatches(group: string): StandingsMatch<string>[] {
  return example.group_matches
    .filter((match) => match.group === group)
    .map((match) => ({
      homeId: match.home,
      awayId: match.away,
      status: 'forfeit' in match && match.forfeit ? 'forfeited' : 'finished',
      homeScore: match.home_score,
      awayScore: match.away_score,
    }));
}

function table(group: string) {
  return computeStandings({ teamIds: groupTeams(group), matches: groupMatches(group), rules });
}

const summary = (group: string) => table(group).rows.map((row) => [row.teamId, row.points]);

describe('classifiche dei gironi dell’edizione di esempio', () => {
  it('T1 - girone A, caso semplice: FAR 7, SCO 4, GAB 3, DAR 2', () => {
    expect(summary('A')).toEqual([
      ['FAR', 7],
      ['SCO', 4],
      ['GAB', 3],
      ['DAR', 2],
    ]);
    const far = table('A').rows[0];
    expect(far).toMatchObject({ played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 7, goalsAgainst: 2, goalDiff: 5 });
  });

  it('T2 - girone B, tre squadre a pari punti: decidono gli scontri diretti (MOL, TRA, MAE)', () => {
    const result = table('B');
    expect(summary('B')).toEqual([
      ['BAG', 9],
      ['MOL', 3],
      ['TRA', 3],
      ['MAE', 3],
    ]);
    // MOL e TRA hanno la stessa differenza reti generale: la generale non basterebbe a separarle.
    const byTeam = new Map(result.rows.map((row) => [row.teamId, row]));
    expect(byTeam.get('MOL')?.goalDiff).toBe(-1);
    expect(byTeam.get('TRA')?.goalDiff).toBe(-1);
    expect(byTeam.get('MAE')?.goalDiff).toBe(-3);
    expect(result.notes).toEqual([{ criterion: 'head_to_head_goal_diff', teamIds: ['MOL', 'TRA', 'MAE'] }]);
    expect(result.rows.every((row) => !row.tied)).toBe(true);
  });

  it('T3 - girone C: POC 7, VEB 5, SAL 3, PIN 1', () => {
    expect(summary('C')).toEqual([
      ['POC', 7],
      ['VEB', 5],
      ['SAL', 3],
      ['PIN', 1],
    ]);
  });

  it('T4 - girone D, due squadre a pari punti: COR avanti per lo scontro diretto', () => {
    const result = table('D');
    expect(summary('D')).toEqual([
      ['LEV', 7],
      ['COR', 4],
      ['ORM', 4],
      ['SAB', 1],
    ]);
    expect(result.notes).toEqual([{ criterion: 'head_to_head_points', teamIds: ['COR', 'ORM'] }]);
  });

  it('le classifiche calcolate coincidono con i risultati attesi dichiarati nel seed', () => {
    for (const [group, expected] of Object.entries(example.expected.standings)) {
      expect(summary(group), `girone ${group}`).toEqual(expected);
      expect(table(group).provisional).toBe(false);
    }
  });

  it('non dipende dall’ordine in cui arrivano squadre e partite', () => {
    const reversed = computeStandings({
      teamIds: [...groupTeams('B')].reverse(),
      matches: [...groupMatches('B')].reverse(),
      rules,
    });
    expect(reversed.rows.map((row) => row.teamId)).toEqual(['BAG', 'MOL', 'TRA', 'MAE']);
  });
});

describe('casi limite', () => {
  it('T5 - quarto ai rigori: BAG-SCO 2-2 (4-3), avanza BAG e i rigori non cambiano i gol', () => {
    const quarter = example.knockout.find((match) => match.home === 'BAG' && match.away === 'SCO');
    expect(quarter).toBeDefined();
    const winner = matchWinner({
      status: 'finished',
      homeScore: quarter!.home_score,
      awayScore: quarter!.away_score,
      homePens: quarter!.home_pens ?? null,
      awayPens: quarter!.away_pens ?? null,
    });
    expect(winner).toBe('home');

    // Se per errore finisse in classifica, i rigori non devono comparire in gol fatti e subiti.
    const result = computeStandings({
      teamIds: ['BAG', 'SCO'],
      matches: [{ homeId: 'BAG', awayId: 'SCO', status: 'finished', homeScore: 2, awayScore: 2 }],
      rules,
    });
    expect(result.rows.map((row) => [row.goalsFor, row.goalsAgainst])).toEqual([
      [2, 2],
      [2, 2],
    ]);
  });

  it('T5 - senza rigori una parità nelle eliminazioni non ha vincitore', () => {
    expect(matchWinner({ status: 'finished', homeScore: 1, awayScore: 1, homePens: null, awayPens: null })).toBeNull();
    expect(matchWinner({ status: 'scheduled', homeScore: null, awayScore: null, homePens: null, awayPens: null })).toBeNull();
  });

  it('T6 - a girone incompleto la classifica è provvisoria', () => {
    const matches = groupMatches('A');
    matches[5] = { ...matches[5], status: 'scheduled', homeScore: null, awayScore: null };
    const result = computeStandings({ teamIds: groupTeams('A'), matches, rules });
    expect(result.provisional).toBe(true);
    expect(result.rows.find((row) => row.teamId === 'GAB')?.played).toBe(2);
    expect(table('A').provisional).toBe(false);
  });

  it('T7 - una partita rinviata non conta; conta una volta sola quando si gioca', () => {
    const base = groupMatches('C');
    const index = example.group_matches.filter((match) => match.group === 'C').findIndex((match) => match.home === 'VEB' && match.away === 'SAL');
    const postponed = base.map((match, i) => (i === index ? { ...match, status: 'postponed' as const, homeScore: null, awayScore: null } : match));

    const during = computeStandings({ teamIds: groupTeams('C'), matches: postponed, rules });
    expect(during.provisional).toBe(true);
    expect(during.rows.find((row) => row.teamId === 'VEB')).toMatchObject({ played: 2, points: 2 });
    expect(during.rows.find((row) => row.teamId === 'SAL')).toMatchObject({ played: 2, points: 3 });

    const after = table('C');
    expect(after.rows.find((row) => row.teamId === 'VEB')).toMatchObject({ played: 3, points: 5 });
    expect(after.rows.reduce((sum, row) => sum + row.played, 0)).toBe(12); // 6 partite, nessuna contata due volte
  });

  it('T8 - la vittoria a tavolino 3-0 assegna punti e gol di classifica', () => {
    const forfeit = example.group_matches.find((match) => 'forfeit' in match && match.forfeit);
    expect(forfeit).toMatchObject({ home: 'COR', away: 'ORM', home_score: 3, away_score: 0 });
    const cor = table('D').rows.find((row) => row.teamId === 'COR');
    expect(cor).toMatchObject({ points: 4, goalsFor: 5, won: 1 });
    expect(rules.forfeit.goals_count_for_scorers).toBe(false);
  });

  it('le partite annullate non contano e non rendono provvisoria la classifica', () => {
    const result = computeStandings({
      teamIds: ['X', 'Y'],
      matches: [{ homeId: 'X', awayId: 'Y', status: 'cancelled', homeScore: null, awayScore: null }],
      rules,
    });
    expect(result.provisional).toBe(false);
    expect(result.rows.every((row) => row.played === 0)).toBe(true);
  });
});

describe('criteri di spareggio configurabili', () => {
  const three = ['A', 'B', 'C'];
  const circular: StandingsMatch<string>[] = [
    { homeId: 'A', awayId: 'B', status: 'finished', homeScore: 1, awayScore: 0 },
    { homeId: 'B', awayId: 'C', status: 'finished', homeScore: 1, awayScore: 0 },
    { homeId: 'C', awayId: 'A', status: 'finished', homeScore: 1, awayScore: 0 },
  ];

  it('scontri diretti circolari e tutto pari: resta un pari merito finché non c’è il sorteggio', () => {
    const result = computeStandings({ teamIds: three, matches: circular, rules });
    expect(result.rows.every((row) => row.tied && row.position === 1)).toBe(true);
  });

  it('il sorteggio registrato risolve il pari merito', () => {
    const result = computeStandings({ teamIds: three, matches: circular, rules, lotOrder: ['C', 'A', 'B'] });
    expect(result.rows.map((row) => row.teamId)).toEqual(['C', 'A', 'B']);
    expect(result.rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(result.notes[0]).toEqual({ criterion: 'draw_lot', teamIds: ['C', 'A', 'B'] });
  });

  it('il fair play separa due squadre altrimenti pari: meno cartellini è meglio', () => {
    const result = computeStandings({
      teamIds: ['A', 'B'],
      matches: [
        {
          homeId: 'A',
          awayId: 'B',
          status: 'finished',
          homeScore: 1,
          awayScore: 1,
          discipline: { home: { yellow: 2, red: 0 }, away: { yellow: 0, red: 1 } },
        },
      ],
      rules,
    });
    expect(result.rows.map((row) => [row.teamId, row.fairPlay])).toEqual([
      ['A', 2],
      ['B', 3],
    ]);
  });

  it('cambiando i punti in configurazione cambia la classifica, non il programma', () => {
    const twoPoints = { ...rules, points: { win: 2, draw: 1, loss: 0 } };
    const result = computeStandings({ teamIds: groupTeams('A'), matches: groupMatches('A'), rules: twoPoints });
    expect(result.rows[0]).toMatchObject({ teamId: 'FAR', points: 5 });
  });

  it('con la differenza reti generale prima degli scontri diretti, COR e ORM restano nello stesso ordine ma per un altro criterio', () => {
    const custom = { ...rules, tiebreakers: ['points', 'goal_diff', 'head_to_head_points'] as typeof rules.tiebreakers };
    const result = computeStandings({ teamIds: groupTeams('D'), matches: groupMatches('D'), rules: custom });
    expect(result.notes).toEqual([{ criterion: 'goal_diff', teamIds: ['COR', 'ORM'] }]);
  });

  it('i valori di partenza del brief sono 3/1/0 con scontri diretti prima della differenza reti', () => {
    expect(DEFAULT_EDITION_CONFIG.points).toEqual({ win: 3, draw: 1, loss: 0 });
    expect(DEFAULT_EDITION_CONFIG.tiebreakers.indexOf('head_to_head_points')).toBeLessThan(DEFAULT_EDITION_CONFIG.tiebreakers.indexOf('goal_diff'));
    expect(DEFAULT_EDITION_CONFIG.groups).toBe(4);
    expect(DEFAULT_EDITION_CONFIG.qualify_per_group).toBe(2);
  });
});

describe('numeri complessivi dell’esempio', () => {
  it('32 partite e 88 gol, rigori esclusi', () => {
    const all = [...example.group_matches, ...example.knockout, example.supercup];
    expect(all).toHaveLength(example.expected.matches_played);
    expect(all.reduce((sum, match) => sum + match.home_score + match.away_score, 0)).toBe(example.expected.total_goals);
  });
});
