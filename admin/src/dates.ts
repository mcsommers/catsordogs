/** The browser's time zone name, for example America/New_York. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Today's date (YYYY-MM-DD) on the signed-in admin's own calendar. */
export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: browserTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
