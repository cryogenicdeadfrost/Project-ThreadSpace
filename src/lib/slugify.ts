/**
 * Slug normalization — the canonical deduplication mechanism.
 * Converts any string to lowercase kebab-case for use as a unique node identifier.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}
