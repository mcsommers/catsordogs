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
