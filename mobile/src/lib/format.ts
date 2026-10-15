/** 7 -> "0:07", 74 -> "1:14". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The recording timer, e.g. "0:07 / 0:14". */
export function timerLabel(elapsedSeconds: number, limitSeconds: number): string {
  return `${clock(Math.min(elapsedSeconds, limitSeconds))} / ${clock(limitSeconds)}`;
}

/** A caption segment's time range, e.g. "0:05 – 0:10". */
export function segmentRange(start: number, end: number): string {
  return `${clock(start)} \u2013 ${clock(Math.ceil(end))}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2010-06-03" -> "June 3, 2010". */
export function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** A Date picked in the phone's own time zone -> "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 69 -> { feet: 5, inches: 9 } */
export function splitHeightInches(totalInches: number): { feet: number; inches: number } {
  const n = Math.max(0, Math.floor(totalInches));
  return { feet: Math.floor(n / 12), inches: n % 12 };
}

/** 69 -> 5'9" */
export function formatHeightFeetInches(totalInches: number): string {
  const { feet, inches } = splitHeightInches(totalInches);
  return `${feet}'${inches}"`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Question pill date segment, e.g. "Oct 5". */
export function shortQuestionDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d}`;
}

/** Full question pill label: "Oct 5 · What are your thoughts on graffiti?" */
export function questionPillLabel(isoDate: string, questionText: string): string {
  return `${shortQuestionDate(isoDate)} · ${questionText}`;
}

export function formatDistanceMiles(miles: number | null): string | null {
  if (miles == null) return null;
  if (miles <= 1) return '1 mile away';
  return `${miles} miles away`;
}

export function formatStreakBadge(days: number): string | null {
  if (days < 1) return null;
  return days === 1 ? '1-day streak' : `${days}-day streak`;
}

/** Profile join badge, e.g. "Joined June 2024". */
export function formatJoinedMonthYear(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `Joined ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Join badge on 08, e.g. "Mar 2026". */
export function formatJoinedShort(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Relative time for match/chat rows, e.g. "2h ago", "Yesterday". */
export function formatRelativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const d = new Date(isoTimestamp);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** People I follow (08i) subtitle, e.g. "Followed on Oct 15". */
export function formatFollowedOn(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `Followed on ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Outgoing match row: "Waiting for a response · Sent yesterday" */
export function formatOutgoingMatchLine(requestedAt: string): string {
  const rel = formatRelativeTime(requestedAt);
  const sent =
    rel === 'Yesterday'
      ? 'Sent yesterday'
      : rel === 'Just now'
        ? 'Sent just now'
        : rel.endsWith(' ago')
          ? `Sent ${rel.replace(' ago', '')} ago`
          : `Sent ${rel}`;
  return `Waiting for a response · ${sent}`;
}

/** Archive row day label: Today, Yesterday, or "Sep 28". */
export function formatAnswerDayLabel(isoDate: string): string {
  const today = toIsoDate(new Date());
  if (isoDate === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (isoDate === toIsoDate(y)) return 'Yesterday';
  return shortQuestionDate(isoDate);
}

export function formatAnswerMeta(isoDate: string, durationSeconds: number): string {
  return `${formatAnswerDayLabel(isoDate)} · ${clock(durationSeconds)}`;
}

/** Woman → "female", Man → "male"; other stored values lowercased. */
function formatGenderForProfile(gender: string | null | undefined): string | null {
  if (!gender) return null;
  if (gender === 'Man') return 'male';
  if (gender === 'Woman') return 'female';
  return gender.toLowerCase();
}

/**
 * Profile hero identity next to age, orientation then gender:
 * "straight male". Returns null when neither value should show.
 */
export function formatProfileIdentityLabel(
  sexualOrientation: string[] | null | undefined,
  gender: string | null | undefined
): string | null {
  const orientation = sexualOrientation?.[0]?.trim();
  const orientationPart = orientation ? orientation.toLowerCase() : null;
  const genderPart = formatGenderForProfile(gender);
  const parts = [orientationPart, genderPart].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** 06j location line: "Brooklyn, NY · 2 miles away". */
export function formatProfileLocation(city: string | null, distanceMiles: number | null): string | null {
  const dist = formatDistanceMiles(distanceMiles);
  if (city && dist) return `${city} · ${dist}`;
  if (city) return city;
  return dist;
}
