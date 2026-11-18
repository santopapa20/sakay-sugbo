/**
 * Makes text comparable for search: lower case, accents removed ("Osmeña"
 * matches "osmena"), punctuation turned into spaces.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
