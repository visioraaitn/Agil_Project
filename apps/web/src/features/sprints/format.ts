/** Date de sprint au format court français (`12 oct. 2026`), `-` si absente. */
export function formatSprintDate(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
