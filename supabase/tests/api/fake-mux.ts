// A stand-in for Mux used by the automated tests, so no real Mux account is
// touched. It answers just the few requests our Edge Functions make, and
// remembers what it was asked so tests can check it.
import { createServer, type Server, type IncomingMessage } from 'node:http';

export type FakeMux = {
  uploadRequests: any[];
  deletedAssets: string[];
  vttRequests: { path: string; token: string | null }[];
  /** Track ids whose caption download should fail, to test retries. */
  failingTracks: Set<string>;
  vtt: string;
  close: () => Promise<void>;
};

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

export async function startFakeMux(port: number): Promise<FakeMux> {
  const state: FakeMux = {
    uploadRequests: [],
    deletedAssets: [],
    vttRequests: [],
    failingTracks: new Set(),
    vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHi there\n\n00:00:02.500 --> 00:00:06.000\nI love <c>dogs</c>\n',
    close: async () => {},
  };
  let counter = 0;

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const send = (status: number, body?: unknown, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
    };

    if (req.method === 'POST' && url.pathname === '/video/v1/uploads') {
      const body = JSON.parse(await readBody(req));
      state.uploadRequests.push(body);
      counter += 1;
      const id = `fake-upload-${Date.now()}-${counter}`;
      return send(201, { data: { id, url: `http://fake-mux.test/upload/${id}`, status: 'waiting', timeout: 3600 } });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/video/v1/assets/')) {
      state.deletedAssets.push(url.pathname.split('/').pop()!);
      return send(204);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/video/v1/assets/')) {
      const id = url.pathname.split('/').pop()!;
      return send(200, { data: { id, status: 'ready', playback_ids: [{ id: `pb-${id}`, policy: 'signed' }] } });
    }
    const vtt = url.pathname.match(/^\/stream\/([^/]+)\/text\/([^/]+)\.vtt$/);
    if (req.method === 'GET' && vtt) {
      state.vttRequests.push({ path: url.pathname, token: url.searchParams.get('token') });
      if (state.failingTracks.has(vtt[2])) return send(500, 'boom', 'text/plain');
      return send(200, state.vtt, 'text/vtt');
    }
    send(404, { error: 'not found in fake Mux' });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}
