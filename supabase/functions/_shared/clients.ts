import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Mux from 'npm:@mux/mux-node@15';
import { requireEnv } from './http.ts';

// Acts as the signed-in user who called the function (so database rules apply to them).
export function userClient(req: Request): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

// Acts as the server (bypasses row rules). Only used for things the app may not do itself.
export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

// MUX_BASE_URL is only set in automated tests, to point at a stand-in for Mux.
export function muxClient(): Mux {
  return new Mux({
    tokenId: requireEnv('MUX_TOKEN_ID'),
    tokenSecret: requireEnv('MUX_TOKEN_SECRET'),
    webhookSecret: Deno.env.get('MUX_WEBHOOK_SECRET') ?? null,
    jwtSigningKey: Deno.env.get('MUX_SIGNING_KEY') ?? null,
    jwtPrivateKey: Deno.env.get('MUX_PRIVATE_KEY') ?? null,
    baseURL: Deno.env.get('MUX_BASE_URL') ?? undefined,
  });
}

export const streamBaseUrl = () => Deno.env.get('MUX_STREAM_BASE_URL') ?? 'https://stream.mux.com';
export const imageBaseUrl = () => Deno.env.get('MUX_IMAGE_BASE_URL') ?? 'https://image.mux.com';
