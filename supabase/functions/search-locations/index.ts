// Returns US city + state suggestions for the Build Profile location field.
import { corsHeaders, json } from '../_shared/http.ts';
import { userClient } from '../_shared/clients.ts';
import { locationSuggestions, searchGeocoding } from '../_shared/geocoding.ts';

const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await userClient(req).auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Not signed in.' }, 401);

  let body: { q?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const q = (body.q ?? '').trim();
  if (q.length < MIN_QUERY) return json({ suggestions: [] });

  try {
    const hits = await searchGeocoding(q, 12);
    return json({ suggestions: locationSuggestions(hits, MAX_SUGGESTIONS) });
  } catch (e) {
    console.error('search-locations failed', e);
    return json({ error: 'We could not search locations. Please try again.' }, 502);
  }
});
