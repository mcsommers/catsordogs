/** Client-side filter for the Interests picker (03e) search field. */
export function filterInterestOptions(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((label) => label.toLowerCase().includes(q));
}
