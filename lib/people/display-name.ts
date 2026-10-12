import type { ConsentStatus, PublishNameMode } from '@/db/schema/enums';

// Funzione unica di formattazione del nome (brief 13.6-13.8): ogni pagina, le statistiche e le
// immagini condivise passano da qui, così un minorenne non può comparire in forme diverse.

export type PersonForDisplay = {
  firstName: string;
  lastName: string;
  isMinor: boolean;
  publishNameMode: PublishNameMode;
  consentStatus: ConsentStatus;
};

export type PublicName = {
  text: string;
  /** Vero se il nome non è pubblicabile e al suo posto compare solo il numero di maglia. */
  hidden: boolean;
};

export type HiddenNameLabels = {
  /** Per esempio «Giocatore n. {n}». */
  withNumber: string;
  /** Per esempio «Giocatore». */
  withoutNumber: string;
};

/**
 * Il nome è nascosto quando: la persona (o il titolare) lo ha chiesto; il consenso è negato;
 * è minorenne e il consenso di chi esercita la responsabilità genitoriale non è registrato.
 */
export function isNameHidden(person: PersonForDisplay): boolean {
  if (person.publishNameMode === 'hidden') return true;
  if (person.consentStatus === 'denied') return true;
  if (person.isMinor && person.consentStatus !== 'received') return true;
  return false;
}

export function publicPersonName(person: PersonForDisplay, shirtNumber: number | null, labels: HiddenNameLabels): PublicName {
  if (isNameHidden(person)) {
    const text = shirtNumber === null ? labels.withoutNumber : labels.withNumber.replace('{n}', String(shirtNumber));
    return { text, hidden: true };
  }
  const first = person.firstName.trim();
  const last = person.lastName.trim();
  // I minorenni compaiono come «Nome C.» salvo scelta esplicita del titolare per il nome completo.
  if (person.publishNameMode === 'initial') {
    return { text: last ? `${first} ${last.charAt(0).toUpperCase()}.` : first, hidden: false };
  }
  return { text: `${first} ${last}`.trim(), hidden: false };
}

/** Forma del nome proposta quando si inserisce una persona nel pannello. */
export function defaultPublishMode(isMinor: boolean): PublishNameMode {
  return isMinor ? 'initial' : 'full';
}
