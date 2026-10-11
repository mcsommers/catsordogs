// A stand-in for the city lookup service, used by the automated tests so no
// real service is contacted. It knows a few cities and counts the lookups.
import { createServer } from 'node:http';

export type FakeGeocoder = { requests: string[]; close: () => Promise<void> };

type Place = {
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  admin1: string;
};

const PLACES: Place[] = [
  { name: 'New York', latitude: 40.7128, longitude: -74.006, country_code: 'US', admin1: 'New York' },
  { name: 'Boston', latitude: 42.3601, longitude: -71.0589, country_code: 'US', admin1: 'Massachusetts' },
  { name: 'Brooklyn', latitude: 40.65, longitude: -73.95, country_code: 'US', admin1: 'New York' },
  { name: 'Brooklyn Center', latitude: 45.0761, longitude: -93.3327, country_code: 'US', admin1: 'Minnesota' },
];

function label(p: Place): string {
  const abbr: Record<string, string> = {
    'New York': 'NY',
    Massachusetts: 'MA',
    Minnesota: 'MN',
  };
  const state = abbr[p.admin1] ?? p.admin1;
  return `${p.name}, ${state}`;
}

function matchesQuery(place: Place, q: string): boolean {
  const needle = q.toLowerCase();
  return place.name.toLowerCase().includes(needle) || label(place).toLowerCase().includes(needle);
}

export async function startFakeGeocoder(port: number): Promise<FakeGeocoder> {
  const state: FakeGeocoder = { requests: [], close: async () => {} };
  const server = createServer((req, res) => {
    const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
    const name = (params.get('name') ?? '').toLowerCase();
    const count = Math.max(1, Number(params.get('count') ?? '1') || 1);
    state.requests.push(name);

    const hits = PLACES.filter((p) => matchesQuery(p, name)).slice(0, count);
    const results = hits.length
      ? hits
      : PLACES.filter((p) => p.name.toLowerCase() === name).slice(0, 1);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results.length ? { results } : {}));
  });
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}
