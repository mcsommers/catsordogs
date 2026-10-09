// Shared sign-up for the API tests.
// Email confirmation is on, so sign-up does not return a session. Tests confirm
// the address with the server key (the same thing the email link does) and
// then sign in. A real person taps the link, which opens the app.
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

export const testPassword = 'correct-horse-battery';

export async function signUpAndSignIn(email: string, password = testPassword): Promise<{
  client: SupabaseClient;
  id: string;
  email: string;
  token: string;
}> {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'catsordogs://auth-callback' },
  });
  assert.ifError(error);
  assert.ok(data.user, 'sign-up creates the account');
  assert.equal(data.session, null, 'sign-up waits for the email link before signing in');

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const confirmed = await service.auth.admin.updateUserById(data.user.id, { email_confirm: true });
  assert.ifError(confirmed.error);

  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  assert.ok(signed.data.session, 'signing in works after the email is confirmed');
  return { client, id: data.user.id, email, token: signed.data.session.access_token };
}
