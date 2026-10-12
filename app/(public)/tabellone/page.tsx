import { redirectToEdition } from '@/lib/data/shortcuts';

export default async function BracketShortcut() {
  await redirectToEdition('tabellone');
}
