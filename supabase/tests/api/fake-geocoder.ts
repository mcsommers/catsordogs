// A stand-in for the city lookup service, used by the automated tests so no
// real service is contacted. It knows a few cities and counts the lookups.
import { createServer } from 'node:http';

export type FakeGeocoder = { requests: string[]; close: () => Promise<void> };

const CITIES: Record<string, { latitude: number; longitude: number }> = {
  'new york': { latitude: 40.7128, longitude: -74.006 },
  boston: { latitude: 42.3601, longitude: -71.0589 },
};

export async function startFakeGeocoder(port: number): Promise<FakeGeocoder> {
  const state: FakeGeocoder = { requests: [], close: async () => {} };
  const server = createServer((req, res) => {
    const name = (new URL(req.url ?? '/', 'http://localhost').searchParams.get('name') ?? '').toLowerCase();
    state.requests.push(name);
    const hit = CITIES[name];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hit ? { results: [hit] } : {}));
  });
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}
