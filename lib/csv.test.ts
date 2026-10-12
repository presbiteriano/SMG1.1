import { describe, expect, it } from 'vitest';
import { parseCsv, parseMatchesCsv, toCsv } from './csv';

describe('lettura CSV', () => {
  it('capisce virgola o punto e virgola e le virgolette', () => {
    expect(parseCsv('a;b\n"uno;due";"dice ""ciao"""\n')).toEqual([
      ['a', 'b'],
      ['uno;due', 'dice "ciao"'],
    ]);
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('importa i risultati storici nel formato del pannello', () => {
    const csv = [
      'competizione;fase;girone;giornata;data;ora;casa;ospite;gol_casa;gol_ospite;rigori_casa;rigori_ospite;stato',
      'Coppa;Gironi;A;1;07/06/2027;20:00;Faro Rovers;Gabbiani FC;2;1;;;',
      'Coppa;Quarti;;;2027-06-15;20.45;Bagni Atletico;Scogliera Boys;2;2;4;3;finita',
      'Coppa;Gironi;D;1;08/06/2027;21:30;Corallo FC;Ormeggio Team;3;0;;;a tavolino',
      'Coppa;Finale;;;;;Porto Canale;Bagni Atletico;;;;;',
    ].join('\n');
    const { rows, headerOk } = parseMatchesCsv(csv);
    expect(headerOk).toBe(true);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(rows[0]).toMatchObject({ line: 2, stage: 'group', group: 'A', round: 1, date: '2027-06-07', time: '20:00', home: 'Faro Rovers', homeScore: 2, awayScore: 1, status: 'finished' });
    expect(rows[1]).toMatchObject({ stage: 'quarter', date: '2027-06-15', time: '20:45', homePens: 4, awayPens: 3, status: 'finished' });
    expect(rows[2].status).toBe('forfeited');
    expect(rows[3]).toMatchObject({ stage: 'final', status: 'scheduled', homeScore: null, date: null });
  });

  it('segnala riga per riga che cosa non torna', () => {
    const { rows } = parseMatchesCsv('casa,ospite,data,ora,gol_casa,gol_ospite,fase,stato\nFAR,FAR,32-13-2027,25:00,x,1,boh,forse\n');
    expect(rows[0].errors.sort()).toEqual(['date', 'score', 'stage', 'status', 'team', 'time']);
  });

  it('senza le colonne casa e ospite l’intestazione non è valida', () => {
    expect(parseMatchesCsv('squadra,punti\nFAR,7\n').headerOk).toBe(false);
    expect(parseMatchesCsv('').headerOk).toBe(false);
  });
});

describe('scrittura CSV', () => {
  it('protegge le celle che un foglio di calcolo eseguirebbe come formule', () => {
    const csv = toCsv(['squadra', 'note'], [['=CMD()', 'ok; "bene"']]);
    expect(csv).toBe('﻿squadra;note\r\n\'=CMD();"ok; ""bene"""\r\n');
  });
});
