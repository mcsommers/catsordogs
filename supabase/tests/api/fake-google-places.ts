// A stand-in for Google Places Autocomplete (New) and Place Details (New).
// Used by the automated tests so no real Google account is contacted.
import { createServer, type IncomingMessage } from 'node:http';

export type FakeGooglePlaces = { requests: string[]; close: () => Promise<void> };

type Place = {
  id: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  country: string;
};

const PLACES: Place[] = [
  { id: 'new-york-ny', city: 'New York', state: 'NY', latitude: 40.7128, longitude: -74.006, country: 'US' },
  { id: 'boston-ma', city: 'Boston', state: 'MA', latitude: 42.3601, longitude: -71.0589, country: 'US' },
  { id: 'brooklyn-ny', city: 'Brooklyn', state: 'NY', latitude: 40.65, longitude: -73.95, country: 'US' },
  { id: 'brooklyn-center-mn', city: 'Brooklyn Center', state: 'MN', latitude: 45.0761, longitude: -93.3327, country: 'US' },
];

function label(p: Place): string {
  return `${p.city}, ${p.state}`;
}

function matchesQuery(place: Place, q: string): boolean {
  const needle = q.toLowerCase();
  return place.city.toLowerCase().includes(needle) || label(place).toLowerCase().includes(needle);
}

function predictionTypes(p: Place): string[] {
  // Google classifies NYC boroughs as sublocality, not locality / (cities).
  return p.id === 'brooklyn-ny' ? ['sublocality', 'political'] : ['locality', 'political'];
}

function prediction(p: Place) {
  return {
    placePrediction: {
      placeId: p.id,
      text: { text: `${label(p)}, USA` },
      structuredFormat: {
        mainText: { text: p.city },
        secondaryText: {
          text: p.id === 'brooklyn-ny' ? 'NY, USA' : `${p.state}, USA`,
        },
      },
      types: predictionTypes(p),
    },
  };
}

function details(p: Place) {
  return {
    id: p.id,
    formattedAddress: `${label(p)}, USA`,
    location: { latitude: p.latitude, longitude: p.longitude },
    addressComponents: [
      {
        longText: p.city,
        shortText: p.city,
        types: p.id === 'brooklyn-ny' ? ['sublocality', 'political'] : ['locality'],
      },
      { longText: p.state, shortText: p.state, types: ['administrative_area_level_1'] },
      { longText: 'United States', shortText: p.country, types: ['country'] },
    ],
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function startFakeGooglePlaces(port: number, expectedKey: string): Promise<FakeGooglePlaces> {
  const state: FakeGooglePlaces = { requests: [], close: async () => {} };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const key = req.headers['x-goog-api-key'];
    if (key !== expectedKey) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'API key was invalid.' } }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/places:autocomplete') {
      const body = JSON.parse((await readBody(req)) || '{}') as { input?: string };
      const q = (body.input ?? '').trim();
      state.requests.push(`autocomplete:${q.toLowerCase()}`);
      const hits = PLACES.filter((p) => matchesQuery(p, q)).slice(0, 6);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ suggestions: hits.map(prediction) }));
      return;
    }

    const detailsMatch = url.pathname.match(/^\/v1\/places\/([^/]+)$/);
    if (req.method === 'GET' && detailsMatch) {
      const id = decodeURIComponent(detailsMatch[1]);
      state.requests.push(`details:${id}`);
      const place = PLACES.find((p) => p.id === id);
      if (!place) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Place not found.' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(details(place)));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Not found.' } }));
  });
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}
