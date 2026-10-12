import { redirectToEdition } from '@/lib/data/shortcuts';

export default async function StandingsShortcut() {
  await redirectToEdition('classifica');
}
