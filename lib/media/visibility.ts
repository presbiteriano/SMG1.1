// Regola unica per decidere se un file è pubblico (brief 11.1, 13.6, T10).
// La usano la galleria, l'indirizzo diretto /media/[id], la sitemap e le anteprime social.

export type MediaVisibilityInput = {
  kind: string;
  approvedAt: Date | string | null;
  rejectedAt: Date | string | null;
  consentPublish: boolean;
  containsMinors: boolean;
};

/** Una foto con minorenni riconoscibili si può approvare solo con le liberatorie raccolte. */
export function canApproveMedia(item: Pick<MediaVisibilityInput, 'consentPublish' | 'containsMinors'>): boolean {
  return !item.containsMinors || item.consentPublish;
}

/** Mai pubblico senza approved_at; mai pubblico se respinto o se mancano le liberatorie. */
export function isMediaPublic(item: MediaVisibilityInput): boolean {
  if (!item.approvedAt || item.rejectedAt) return false;
  return canApproveMedia(item);
}
