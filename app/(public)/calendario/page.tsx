import { redirectToEdition } from '@/lib/data/shortcuts';

export default async function CalendarShortcut() {
  await redirectToEdition('calendario');
}
