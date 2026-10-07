// Stand-ins for Expo's push service and Resend's email service, used by the
// automated tests so nothing real is contacted or sent.
import { createServer, type Server } from 'node:http';

export type FakeNotify = {
  pushMessages: { to: string; title: string; body: string; data: any }[];
  emails: { authorization: string | undefined; body: any }[];
  /** When set, email requests fail with this status. */
  emailFailsWith: number | null;
  close: () => Promise<void>;
};

export async function startFakeNotify(port: number): Promise<FakeNotify> {
  const state: FakeNotify = { pushMessages: [], emails: [], emailFailsWith: null, close: async () => {} };
  const server: Server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && req.url === '/expo/push/send') {
      const messages = JSON.parse(raw) as FakeNotify['pushMessages'];
      state.pushMessages.push(...messages);
      // a token with "dead" in it stands for a phone that has uninstalled the app
      return reply(200, {
        data: messages.map((m) =>
          m.to.includes('dead') ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'ticket' },
        ),
      });
    }
    if (req.method === 'POST' && req.url === '/resend/emails') {
      state.emails.push({ authorization: req.headers.authorization, body: JSON.parse(raw) });
      if (state.emailFailsWith) return reply(state.emailFailsWith, { message: 'failed' });
      return reply(200, { id: 'email-id' });
    }
    reply(404, { error: 'not found in fake notify' });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}
