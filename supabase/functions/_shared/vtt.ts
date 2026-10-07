// Turns a WebVTT caption file (what Mux produces) into a simple list of
// segments. Plain TypeScript with no imports so it can be tested with Node and
// run in the Edge Function.

export type CaptionSegment = { start: number; end: number; text: string };

const MAX_TEXT_LENGTH = 500;

function parseTimestamp(raw: string): number | null {
  // 00:01:02.500 or 01:02.500 (some files use a comma instead of a dot)
  const m = raw.trim().replace(',', '.').match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const hours = m[1] ? Number(m[1]) : 0;
  const millis = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return hours * 3600 + Number(m[2]) * 60 + Number(m[3]) + millis / 1000;
}

export function parseVtt(vtt: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const blocks = vtt.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex === -1) continue; // header, NOTE, STYLE, or a blank block

    const [startRaw, endRaw] = lines[timingIndex].split('-->');
    const start = parseTimestamp(startRaw);
    // the end timestamp may be followed by cue settings such as "align:start"
    const end = parseTimestamp((endRaw ?? '').trim().split(/\s+/)[0] ?? '');
    if (start === null || end === null || end < start) continue;

    const text = lines
      .slice(timingIndex + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '') // remove styling tags like <c> and <v Speaker>
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;

    segments.push({ start, end, text: text.slice(0, MAX_TEXT_LENGTH) });
  }
  return segments;
}
