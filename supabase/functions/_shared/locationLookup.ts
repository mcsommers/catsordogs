// Picks Open-Meteo or Google Places from the admin setting. Callers stay
// the same; Open-Meteo code in geocoding.ts is unused when Google is selected.

import { serviceClient } from './clients.ts';
import { geocodeOne, locationSuggestions, searchGeocoding } from './geocoding.ts';
import { geocodeGooglePlace, searchGooglePlaces } from './googlePlaces.ts';

export type LocationProvider = 'open_meteo' | 'google_places';

export async function readLocationProvider(): Promise<LocationProvider> {
  const { data, error } = await serviceClient().from('app_settings').select('location_provider').single();
  if (error) throw error;
  return data?.location_provider === 'google_places' ? 'google_places' : 'open_meteo';
}

export async function suggestionsForQuery(query: string, max: number): Promise<string[]> {
  if ((await readLocationProvider()) === 'google_places') {
    return searchGooglePlaces(query, max);
  }
  const hits = await searchGeocoding(query, 12);
  return locationSuggestions(hits, max);
}

export async function coordinatesForCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  if ((await readLocationProvider()) === 'google_places') {
    return geocodeGooglePlace(city);
  }
  return geocodeOne(city);
}
