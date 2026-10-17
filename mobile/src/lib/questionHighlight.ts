function escapeRegex(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits question copy for 06d search highlighting (orange bold matches). */
export function questionHighlightParts(
  questionText: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text: questionText, highlight: false }];
  const re = new RegExp(`(${words.map(escapeRegex).join('|')})`, 'gi');
  const bits = questionText.split(re);
  return bits
    .filter((part) => part.length > 0)
    .map((text) => ({
      text,
      highlight: words.some((w) => text.toLowerCase() === w.toLowerCase()),
    }));
}
