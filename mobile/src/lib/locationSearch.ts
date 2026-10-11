import { supabase } from './supabase';

/** US city + state labels from the server geocoding search (signed-in users only). */
export async function fetchLocationSuggestions(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.functions.invoke('search-locations', { body: { q } });
  if (error) return [];
  const list = data?.suggestions;
  return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
}
