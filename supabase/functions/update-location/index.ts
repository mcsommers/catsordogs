// Looks up coordinates for the city on the caller's profile, so "Maximum
// distance" and the distance shown on answers can work. The app calls this
// after saving the profile's city. Users can never write coordinates
// themselves: this function looks the city up and stores the result with the
// server key, and only if the profile still has that city.
//
// The lookup service is set by GEOCODING_URL (default: Open-Meteo's free
// geocoding search). It must accept ?name=<city>&count=1 and answer with
// { results: [{ latitude, longitude }] }. Check the provider's terms before
// launch: Open-Meteo's free service is for non-commercial use.
import { corsHeaders, json } from '../_shared/http.ts';
import { serviceClient, userClient } from '../_shared/clients.ts';

const DEFAULT_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

async function lookUp(city: string): Promise<{ latitude: number; longitude: number } | null> {
  const url = new URL(Deno.env.get('GEOCODING_URL') || DEFAULT_GEOCODING_URL);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed with status ${res.status}.`);
  const hit = (await res.json())?.results?.[0];
  if (typeof hit?.latitude !== 'number' || typeof hit?.longitude !== 'number') return null;
  return { latitude: hit.latitude, longitude: hit.longitude };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const user = userClient(req);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await user.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Not signed in.' }, 401);

  // Row rules: a user can read only their own profile row.
  const { data: profile, error } = await user
    .from('profiles').select('city, latitude, longitude').eq('id', auth.user.id).single();
  if (error || !profile) return json({ error: 'No profile found.' }, 404);

  const city = profile.city?.trim() || null;
  if (!city) {
    await serviceClient().rpc('set_profile_location', {
      p_user_id: auth.user.id, p_city: profile.city, p_latitude: null, p_longitude: null,
    });
    return json({ found: false });
  }
  // Already looked up for this city (changing the city clears the coordinates).
  if (profile.latitude !== null && profile.longitude !== null) return json({ found: true });

  try {
    const place = await lookUp(city);
    if (!place) return json({ found: false });
    const { error: saveError } = await serviceClient().rpc('set_profile_location', {
      p_user_id: auth.user.id, p_city: profile.city, p_latitude: place.latitude, p_longitude: place.longitude,
    });
    if (saveError) throw saveError;
    return json({ found: true });
  } catch (e) {
    console.error('update-location failed', e);
    return json({ error: 'We could not look up that city. Please try again.' }, 502);
  }
});
