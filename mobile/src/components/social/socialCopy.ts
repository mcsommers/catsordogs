/** Pronoun helpers for confirmation copy (MVP / Pencil tone). */
export function subjectPronoun(gender: string | null | undefined): 'she' | 'he' | 'they' {
  const g = (gender ?? '').toLowerCase();
  if (g === 'woman') return 'she';
  if (g === 'man') return 'he';
  return 'they';
}

export function objectPronoun(gender: string | null | undefined): 'her' | 'him' | 'them' {
  const g = (gender ?? '').toLowerCase();
  if (g === 'woman') return 'her';
  if (g === 'man') return 'him';
  return 'them';
}

export function possessivePronoun(gender: string | null | undefined): 'her' | 'his' | 'their' {
  const g = (gender ?? '').toLowerCase();
  if (g === 'woman') return 'her';
  if (g === 'man') return 'his';
  return 'their';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
