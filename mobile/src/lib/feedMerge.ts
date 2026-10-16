import type { FeedItem } from './feed';

/** Keep FlatList keys unique when pagination races a full reload (e.g. after feed settings save). */
export function appendUniqueFeedItems(prev: FeedItem[], next: FeedItem[]): FeedItem[] {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((it) => it.answerId));
  const merged = [...prev];
  for (const item of next) {
    if (seen.has(item.answerId)) continue;
    seen.add(item.answerId);
    merged.push(item);
  }
  return merged;
}
