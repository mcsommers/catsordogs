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

/**
 * Woman → she/her/her; Man → he/him/his; any More gender or missing → they/them/their.
 * `matches` is the verb that agrees with the subject ("she matches" / "they match").
 */
export function pronouns(gender: string | null | undefined) {
  const subject = subjectPronoun(gender);
  const object = objectPronoun(gender);
  const possessive = possessivePronoun(gender);
  return {
    subject,
    Subject: capitalize(subject),
    object,
    possessive,
    Possessive: capitalize(possessive),
    matches: subject === 'they' ? 'match' : 'matches',
  };
}
