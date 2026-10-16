// Google Places Autocomplete (New) + Place Details (New) for US city/state
// labels and coordinates. Used when app_settings.location_provider is
// google_places. The Open-Meteo path in geocoding.ts is unchanged.

import { usStateAbbreviation } from './geocoding.ts';

const DEFAULT_PLACES_URL = 'https://places.googleapis.com';
const MAX_SUGGESTIONS = 6;

type TextVal = { text?: string };
type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

export type GooglePlacePrediction = {
  placeId?: string;
  text?: TextVal;
  structuredFormat?: { mainText?: TextVal; secondaryText?: TextVal };
  types?: string[];
};

export type GooglePlaceDetails = {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AddressComponent[];
};

function placesBaseUrl(): string {
  return (Deno.env.get('GOOGLE_PLACES_BASE_URL') || DEFAULT_PLACES_URL).replace(/\/$/, '');
}

function apiKey(): string {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY')?.trim();
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set.');
  return key;
}

const CITY_TYPES = new Set([
  'locality',
  'sublocality',
  'sublocality_level_1',
  'administrative_area_level_3',
  'neighborhood',
  'postal_town',
]);

/** Primary types for Autocomplete — not `(cities)`, which drops NYC boroughs. */
const AUTOCOMPLETE_PRIMARY_TYPES = [
  'locality',
  'sublocality',
  'sublocality_level_1',
  'administrative_area_level_3',
  'postal_town',
];

function looksLikeCity(types: string[] | undefined): boolean {
  if (!types?.length) return true;
  return types.some((t) => CITY_TYPES.has(t));
}

function stateFromSecondary(secondary: string): string | null {
  const parts = secondary.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.toUpperCase() === 'USA' || part.toUpperCase() === 'US') continue;
    const abbr = usStateAbbreviation(part);
    if (abbr.length === 2) return abbr;
  }
  return null;
}

function labelFromFullText(full: string | undefined): string | null {
  if (!full) return null;
  const cleaned = full.replace(/,?\s*USA$/i, '').replace(/,?\s*United States$/i, '').trim();
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const city = parts[0];
  const state = usStateAbbreviation(parts[1]);
  if (!city || state.length !== 2) return null;
  return `${city}, ${state}`;
}

/** "Brooklyn, NY" from a Places Autocomplete prediction. Non-US / unusable → null. */
export function formatGooglePrediction(pred: GooglePlacePrediction): string | null {
  if (!looksLikeCity(pred.types)) return null;
  const city = pred.structuredFormat?.mainText?.text?.trim();
  const secondary = pred.structuredFormat?.secondaryText?.text?.trim() ?? '';
  const state = stateFromSecondary(secondary);
  if (city && state) return `${city}, ${state}`;
  return labelFromFullText(pred.text?.text);
}

/** Lat/lng for a US place from Place Details Essentials fields. */
export function coordinatesFromPlaceDetails(details: GooglePlaceDetails): {
  latitude: number;
  longitude: number;
} | null {
  const lat = details.location?.latitude;
  const lng = details.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const country = details.addressComponents?.find((c) => c.types?.includes('country'));
  if (country?.shortText && country.shortText !== 'US') return null;
  return { latitude: lat, longitude: lng };
}

async function autocomplete(query: string): Promise<GooglePlacePrediction[]> {
  const res = await fetch(`${placesBaseUrl()}/v1/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ['us'],
      includedPrimaryTypes: AUTOCOMPLETE_PRIMARY_TYPES,
      languageCode: 'en',
    }),
  });
  if (!res.ok) throw new Error(`Google Places autocomplete failed with status ${res.status}.`);
  const json = await res.json();
  const suggestions = json?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions
    .map((s: { placePrediction?: GooglePlacePrediction }) => s?.placePrediction)
    .filter((p: GooglePlacePrediction | undefined): p is GooglePlacePrediction => Boolean(p));
}

async function placeDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  const id = placeId.replace(/^places\//, '');
  const res = await fetch(`${placesBaseUrl()}/v1/places/${encodeURIComponent(id)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
    },
  });
  if (!res.ok) throw new Error(`Google Place Details failed with status ${res.status}.`);
  return (await res.json()) as GooglePlaceDetails;
}

export async function searchGooglePlaces(query: string, max = MAX_SUGGESTIONS): Promise<string[]> {
  const preds = await autocomplete(query);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pred of preds) {
    const label = formatGooglePrediction(pred);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

export async function geocodeGooglePlace(city: string): Promise<{ latitude: number; longitude: number } | null> {
  const needle = city.trim().toLowerCase();
  const preds = await autocomplete(city);
  const ranked = [...preds].sort((a, b) => {
    const la = formatGooglePrediction(a)?.toLowerCase() ?? '';
    const lb = formatGooglePrediction(b)?.toLowerCase() ?? '';
    const ea = la === needle ? 0 : 1;
    const eb = lb === needle ? 0 : 1;
    return ea - eb;
  });
  for (const pred of ranked) {
    if (!formatGooglePrediction(pred) || !pred.placeId) continue;
    const details = await placeDetails(pred.placeId);
    if (!details) continue;
    const coords = coordinatesFromPlaceDetails(details);
    if (coords) return coords;
  }
  return null;
}
