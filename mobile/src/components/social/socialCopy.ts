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

/** Follow confirmation body (06l). Mid-sentence pronouns stay lowercase. */
export function followDialogBody(gender: string | null | undefined): string {
  const p = pronouns(gender);
  return `${p.Subject} won't know you're following ${p.object}. ${p.Possessive} answer will show up at the top of your feed every day ${p.subject} posts.`;
}

/** Nudge card title (06n). */
export function nudgeCardTitle(firstName: string): string {
  return `${firstName} hasn't answered today yet`;
}

/** Nudge card body (06n). Woman → she/her; Man → he/him; else → they/them. */
export function nudgeCardBody(gender: string | null | undefined): string {
  const p = pronouns(gender);
  return `Give ${p.object} a nudge. ${p.Subject}'ll only be told that a follower wants to hear ${p.possessive} answer, never who.`;
}

/** Match request card title on the sender's profile (07h). */
export function matchRequestCardTitle(firstName: string): string {
  return `Match with ${firstName}?`;
}

/** Match request card body (07h): liked-answer line or want-to-match, plus relative time. */
export function incomingMatchCardBody(questionText: string | null, requestedAtLabel: string): string {
  if (questionText) return `Liked your answer to ${questionText} · ${requestedAtLabel}`;
  return `Wants to match with you · ${requestedAtLabel}`;
}

/** Accept incoming match confirmation body (07h). */
export function acceptMatchDialogBody(firstName: string): string {
  return `You'll be matched with ${firstName} and can chat with each other right away.`;
}

/** Shown at the top of a new chat after accepting a match request (07c). */
export function newMatchChatIntro(firstName: string): string {
  return `You and ${firstName} are now matched. You can chat with each other now.`;
}

/** Shown to the person who was unmatched. They can still read the chat (07c). */
export function unmatchedChatNotice(firstName: string): string {
  return `${firstName} unmatched you. You can no longer chat.`;
}

/** Nudge confirmation body (06o). */
export function nudgeDialogBody(gender: string | null | undefined): string {
  const p = pronouns(gender);
  return `${p.Subject}'ll be told that a follower wants to hear ${p.possessive} answer to today's question. ${p.Subject} won't know who. You can nudge ${p.object} once a day.`;
}
