import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import {
  announcements,
  competitions,
  documents,
  editions,
  honours,
  matches,
  media,
  siteSettings,
  sponsorEditions,
  sponsors,
  teamEntries,
  teams,
} from '@/db/schema';
import type { EditionStatus } from '@/db/schema/enums';
import { parseSiteSettings } from '@/lib/config/site-settings';
import { isMediaPublic } from '@/lib/media/visibility';
import type { Db } from './db';
import type { DocumentDTO, EditionSummary, HallRow, HonourCell, PhotoDTO, SiteBundle, TeamIndexEntry } from './dto';
import { loadEditionBundle } from './edition-bundle';

// Dati comuni a tutte le pagine: impostazioni, elenco delle edizioni, avvisi, sponsor.

// Quale edizione guida la home: prima quella in corso, poi in programma, iscrizioni, annunciata, conclusa.
const FEATURE_PRIORITY: Record<EditionStatus, number> = {
  live: 6,
  scheduled: 5,
  registrations_open: 4,
  announced: 3,
  finished: 2,
  archived: 1,
  draft: 0,
};

export async function loadSiteBundle(db: Db): Promise<SiteBundle> {
  const [settingsRow] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

  const editionRows = await db.select().from(editions).where(ne(editions.status, 'draft')).orderBy(desc(editions.year));
  const editionIds = editionRows.map((row) => row.id);

  const competitionRows = editionIds.length
    ? await db.select().from(competitions).where(inArray(competitions.editionId, editionIds)).orderBy(asc(competitions.order), asc(competitions.id))
    : [];
  const matchCounts = editionIds.length
    ? await db
        .select({ editionId: matches.editionId, total: count() })
        .from(matches)
        .where(and(inArray(matches.editionId, editionIds), isNull(matches.archivedAt)))
        .groupBy(matches.editionId)
    : [];
  const teamCounts = editionIds.length
    ? await db
        .select({ editionId: teamEntries.editionId, total: count() })
        .from(teamEntries)
        .where(and(inArray(teamEntries.editionId, editionIds), ne(teamEntries.status, 'withdrawn')))
        .groupBy(teamEntries.editionId)
    : [];

  const summaries: EditionSummary[] = editionRows.map((row) => ({
    id: row.id,
    year: row.year,
    name: row.name,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    matchCount: matchCounts.find((item) => item.editionId === row.id)?.total ?? 0,
    teamCount: teamCounts.find((item) => item.editionId === row.id)?.total ?? 0,
    competitions: competitionRows.filter((item) => item.editionId === row.id).map((item) => ({ slug: item.slug, name: item.name, type: item.type })),
    isExample: row.source === 'example',
  }));

  const featured = [...summaries].sort((a, b) => FEATURE_PRIORITY[b.status] - FEATURE_PRIORITY[a.status] || b.year - a.year)[0];
  const withData = summaries.find((item) => item.matchCount > 0);

  const now = new Date();
  const announcementRows = await db
    .select({ announcement: announcements, year: editions.year })
    .from(announcements)
    .leftJoin(editions, eq(editions.id, announcements.editionId))
    .where(or(isNull(announcements.endsAt), gt(announcements.endsAt, now)))
    .orderBy(desc(announcements.startsAt));

  const sponsorRows = await db
    .select({ sponsor: sponsors, logo: media })
    .from(sponsors)
    .leftJoin(media, eq(media.id, sponsors.logoMediaId))
    .orderBy(asc(sponsors.order), asc(sponsors.name));
  const sponsorLinks = sponsorRows.length
    ? await db
        .select({ sponsorId: sponsorEditions.sponsorId, year: editions.year })
        .from(sponsorEditions)
        .innerJoin(editions, eq(editions.id, sponsorEditions.editionId))
    : [];

  return {
    settings: parseSiteSettings(settingsRow?.data),
    editions: summaries,
    featuredYear: featured?.year ?? null,
    dataYear: withData?.year ?? null,
    announcements: announcementRows.map(({ announcement, year }) => ({
      id: announcement.id,
      severity: announcement.severity,
      title: announcement.title,
      body: announcement.body,
      link: announcement.link,
      startsAt: announcement.startsAt.toISOString(),
      endsAt: announcement.endsAt ? announcement.endsAt.toISOString() : null,
      editionYear: year,
    })),
    sponsors: sponsorRows.map(({ sponsor, logo }) => ({
      id: sponsor.id,
      name: sponsor.name,
      url: sponsor.url,
      logoId: logo && isMediaPublic(logo) ? logo.id : null,
      tier: sponsor.tier,
      visibleFrom: sponsor.visibleFrom,
      visibleTo: sponsor.visibleTo,
      editionYears: sponsorLinks.filter((link) => link.sponsorId === sponsor.id).map((link) => link.year),
    })),
    hasExampleData: editionRows.some((row) => row.source === 'example'),
  };
}

export async function loadTeamsIndex(db: Db): Promise<TeamIndexEntry[]> {
  const rows = await db
    .select({ team: teams, crest: media })
    .from(teams)
    .leftJoin(media, eq(media.id, teams.crestMediaId))
    .where(isNull(teams.archivedAt))
    .orderBy(asc(teams.name));
  const entries = await db
    .select({ teamId: teamEntries.teamId, year: editions.year })
    .from(teamEntries)
    .innerJoin(editions, eq(editions.id, teamEntries.editionId))
    .where(and(ne(editions.status, 'draft'), ne(teamEntries.status, 'withdrawn')))
    .orderBy(desc(editions.year));
  return rows.map(({ team, crest }) => ({
    teamId: team.id,
    slug: team.slug,
    name: team.name,
    code: team.shortCode,
    kitColor: team.kitColor,
    crestId: crest && isMediaPublic(crest) ? crest.id : null,
    years: entries.filter((entry) => entry.teamId === team.id).map((entry) => entry.year),
  }));
}

/** Solo foto approvate, con liberatorie in regola (T10). Se year è null, di tutte le edizioni. */
export async function loadGallery(db: Db, year: number | null): Promise<PhotoDTO[]> {
  const rows = await db
    .select({ item: media, year: editions.year, status: editions.status })
    .from(media)
    .leftJoin(editions, eq(editions.id, media.editionId))
    .where(and(eq(media.kind, 'photo'), isNotNull(media.approvedAt), isNull(media.rejectedAt)))
    .orderBy(desc(media.createdAt), desc(media.id));
  return rows
    .filter(({ item, year: itemYear, status }) => isMediaPublic(item) && status !== 'draft' && (year === null || itemYear === year))
    .map(({ item, year: itemYear }) => ({
      id: item.id,
      width: item.width ?? 0,
      height: item.height ?? 0,
      variants: item.variants ?? [],
      alt: item.alt ?? '',
      caption: item.caption,
      credit: item.credit,
      matchId: item.matchId,
      year: itemYear,
    }));
}

export async function loadDocument(db: Db, slug: string): Promise<DocumentDTO | null> {
  const [row] = await db.select().from(documents).where(eq(documents.slug, slug)).orderBy(desc(documents.revisedAt), desc(documents.id)).limit(1);
  if (!row) return null;
  return { title: row.title, body: row.body, fileUrl: row.fileUrl, revisedAt: row.revisedAt ? row.revisedAt.toISOString() : null };
}

const emptyCell = (): HonourCell => ({ winner: null, runnerUp: null, topScorer: null });

/** Albo d'oro: dove ci sono le partite si ricava da solo, altrimenti dalle voci inserite a mano. */
export async function loadHallOfFame(db: Db): Promise<HallRow[]> {
  const editionRows = await db.select().from(editions).where(ne(editions.status, 'draft')).orderBy(desc(editions.year));
  const manual = await db.select().from(honours);
  const teamRows = await db.select({ id: teams.id, name: teams.name, slug: teams.slug }).from(teams);
  const teamById = new Map(teamRows.map((row) => [row.id, row]));

  const rows: HallRow[] = [];
  for (const edition of editionRows) {
    const bundle = await loadEditionBundle(db, edition.year);
    const cup = emptyCell();
    const supercup = emptyCell();

    if (bundle?.cup) {
      cup.winner = { name: bundle.cup.winner.name, slug: bundle.cup.winner.slug };
      cup.runnerUp = bundle.cup.runnerUp ? { name: bundle.cup.runnerUp.name, slug: bundle.cup.runnerUp.slug } : null;
      const best = bundle.edition.config.features.stats ? bundle.stats.topScorers[0] : undefined;
      if (best) cup.topScorer = { name: best.name, goals: best.goals };
    }
    if (bundle?.supercupWinner) {
      supercup.winner = { name: bundle.supercupWinner.name, slug: bundle.supercupWinner.slug };
      const final = bundle.matches.find((match) => match.competitionType === 'supercup' && match.winner);
      const loser = final ? (final.winner === 'home' ? final.away : final.home) : null;
      supercup.runnerUp = loser ? { name: loser.name, slug: loser.slug } : null;
    }

    // Le voci inserite a mano completano ciò che le partite non dicono (per esempio un'edizione di cui si sa solo il vincitore).
    for (const honour of manual.filter((item) => item.editionId === edition.id)) {
      const cell = honour.competitionType === 'cup' ? cup : supercup;
      const winnerTeam = honour.winnerTeamId ? teamById.get(honour.winnerTeamId) : undefined;
      const runnerTeam = honour.runnerUpTeamId ? teamById.get(honour.runnerUpTeamId) : undefined;
      if (!cell.winner && (winnerTeam || honour.winnerName)) cell.winner = { name: winnerTeam?.name ?? (honour.winnerName as string), slug: winnerTeam?.slug ?? null };
      if (!cell.runnerUp && (runnerTeam || honour.runnerUpName)) cell.runnerUp = { name: runnerTeam?.name ?? (honour.runnerUpName as string), slug: runnerTeam?.slug ?? null };
      if (!cell.topScorer && honour.topScorerName) cell.topScorer = { name: honour.topScorerName, goals: honour.topScorerGoals };
    }

    if (cup.winner || supercup.winner) {
      rows.push({ year: edition.year, editionName: edition.name, hasDetails: (bundle?.matches.length ?? 0) > 0, cup, supercup });
    }
  }
  return rows;
}
