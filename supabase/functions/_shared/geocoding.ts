// Open-Meteo-style geocoding search (GEOCODING_URL). Used for profile location
// autocomplete and for update-location lookups.

export type GeocodeHit = {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
};

const DEFAULT_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const US_STATE_ABBR: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

export function usStateAbbreviation(admin1: string): string {
  const trimmed = admin1.trim();
  if (trimmed.length === 2 && trimmed === trimmed.toUpperCase()) return trimmed;
  return US_STATE_ABBR[trimmed] ?? trimmed;
}

/** Display label stored on profiles.city (US cities and states). */
export function formatLocationLabel(hit: GeocodeHit): string | null {
  if (hit.country_code && hit.country_code !== 'US') return null;
  const name = hit.name?.trim();
  if (!name) return null;
  const state = hit.admin1?.trim();
  return state ? `${name}, ${usStateAbbreviation(state)}` : name;
}

function geocodingUrl(): URL {
  return new URL(Deno.env.get('GEOCODING_URL') || DEFAULT_GEOCODING_URL);
}

export async function searchGeocoding(query: string, count: number): Promise<GeocodeHit[]> {
  const url = geocodingUrl();
  url.searchParams.set('name', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed with status ${res.status}.`);
  const results = (await res.json())?.results;
  if (!Array.isArray(results)) return [];
  return results.filter(
    (r): r is GeocodeHit =>
      typeof r?.name === 'string' &&
      typeof r?.latitude === 'number' &&
      typeof r?.longitude === 'number'
  );
}

export async function geocodeOne(city: string): Promise<{ latitude: number; longitude: number } | null> {
  const hit = (await searchGeocoding(city, 1))[0];
  if (!hit) return null;
  return { latitude: hit.latitude, longitude: hit.longitude };
}

/** Unique US location labels for autocomplete, in API order. */
export function locationSuggestions(hits: GeocodeHit[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    const label = formatLocationLabel(hit);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}
