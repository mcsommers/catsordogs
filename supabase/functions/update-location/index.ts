// Looks up coordinates for the city on the caller's profile, so "Maximum
// distance" and the distance shown on answers can work. The app calls this
// after saving the profile's city. Users can never write coordinates
// themselves: this function looks the city up and stores the result with the
// server key, and only if the profile still has that city.
//
// Which lookup service to use is the admin setting location_provider
// (Open-Meteo or Google Places). Open-Meteo still honors GEOCODING_URL.
import { corsHeaders, json } from '../_shared/http.ts';
import { serviceClient, userClient } from '../_shared/clients.ts';
import { coordinatesForCity } from '../_shared/locationLookup.ts';

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
    const place = await coordinatesForCity(city);
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
